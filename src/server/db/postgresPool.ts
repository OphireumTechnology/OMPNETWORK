/**
 * OPHIREUM NETWORK — Native PostgreSQL Connection Pool & Transaction Manager (Phases 50–52)
 *
 * Supports:
 * - Native Railway PostgreSQL via DATABASE_URL (private network *.railway.internal or TLS)
 * - Connection pool bounds, acquisition timeouts, statement timeouts, slow-query logging
 * - Bounded transient retry on network/serialization/deadlock failures
 * - Transaction-scoped RLS principal binding (`SET LOCAL app.current_user_id`, `app.current_role`)
 * - Injectable PgQueryable client so real PostgreSQL 16 (PGlite or TCP pg.Pool) can run identical SQL
 */

import { Pool, PoolClient, QueryResultRow } from 'pg';
import { logStructured } from '../logger';

export interface PgQueryResult<T extends QueryResultRow = Record<string, any>> {
  rows: T[];
  rowCount?: number | null;
}

export interface PgQueryable {
  query<T extends QueryResultRow = Record<string, any>>(
    sql: string,
    params?: unknown[]
  ): Promise<PgQueryResult<T>>;
}

export interface TransactionPrincipalContext {
  userId?: string;
  role?: string;
}

export interface PostgresPoolConfig {
  connectionString?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  statementTimeoutMs?: number;
  slowQueryMs?: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
  /** Optional injected PgQueryable (e.g., PGlite wrapper in local PG16 integration tests) */
  queryable?: PgQueryable;
}

const TRANSIENT_PG_CODES = new Set([
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
]);

function isTransientPgError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as any).code || '');
  if (TRANSIENT_PG_CODES.has(code)) return true;
  const msg = String((err as any).message || '');
  return /ECONNRESET|ETIMEDOUT|ECONNREFUSED|Connection terminated unexpectedly/i.test(msg);
}

export function resolvePostgresSslOption(
  connectionString: string,
  envSsl?: string
): boolean | { rejectUnauthorized: boolean } | undefined {
  const normalized = (envSsl || '').trim().toLowerCase();
  if (normalized === 'false' || normalized === 'disable' || normalized === '0') {
    return false;
  }
  if (normalized === 'require' || normalized === 'true' || normalized === '1') {
    return { rejectUnauthorized: false };
  }
  if (normalized === 'verify-full') {
    return { rejectUnauthorized: true };
  }
  // Railway internal private networking (*.railway.internal) and localhost do not require TLS by default
  if (
    /railway\.internal|localhost|127\.0\.0\.1/i.test(connectionString) ||
    /sslmode=disable/i.test(connectionString)
  ) {
    return false;
  }
  return { rejectUnauthorized: false };
}

export class PostgresPoolManager implements PgQueryable {
  public readonly isConfigured: boolean;
  private readonly pool: Pool | null;
  private readonly injectedQueryable: PgQueryable | null;
  private readonly slowQueryMs: number;
  private readonly statementTimeoutMs: number;
  private closed = false;

  constructor(config: PostgresPoolConfig = {}) {
    this.slowQueryMs = config.slowQueryMs ?? Number(process.env.PG_SLOW_QUERY_MS || 500);
    this.statementTimeoutMs = config.statementTimeoutMs ?? Number(process.env.PG_STATEMENT_TIMEOUT_MS || 15_000);

    if (config.queryable) {
      this.injectedQueryable = config.queryable;
      this.pool = null;
      this.isConfigured = true;
      return;
    }

    this.injectedQueryable = null;
    const connectionString = (config.connectionString ?? process.env.DATABASE_URL ?? '').trim();
    if (!connectionString || connectionString.includes('postgres://user:pass@host')) {
      this.pool = null;
      this.isConfigured = false;
      return;
    }

    this.isConfigured = true;
    this.pool = new Pool({
      connectionString,
      max: config.max ?? Number(process.env.PG_POOL_MAX || 20),
      idleTimeoutMillis: config.idleTimeoutMillis ?? Number(process.env.PG_IDLE_TIMEOUT_MS || 30_000),
      connectionTimeoutMillis:
        config.connectionTimeoutMillis ?? Number(process.env.PG_CONNECTION_TIMEOUT_MS || 5_000),
      statement_timeout: this.statementTimeoutMs,
      ssl: config.ssl ?? resolvePostgresSslOption(connectionString, process.env.DATABASE_SSL),
      application_name: 'ophireum-network-api',
    });

    this.pool.on('error', (err) => {
      logStructured('error', 'postgres_pool_idle_client_error', {
        error: err?.message || String(err),
      });
    });
  }

  getPoolMetrics(): {
    configured: boolean;
    closed: boolean;
    mode: 'pg_pool' | 'injected_queryable' | 'unconfigured';
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    if (this.injectedQueryable) {
      return {
        configured: true,
        closed: this.closed,
        mode: 'injected_queryable',
        totalCount: 1,
        idleCount: 1,
        waitingCount: 0,
      };
    }
    if (!this.pool) {
      return {
        configured: false,
        closed: this.closed,
        mode: 'unconfigured',
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
      };
    }
    return {
      configured: true,
      closed: this.closed,
      mode: 'pg_pool',
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  async query<T extends QueryResultRow = Record<string, any>>(
    sql: string,
    params: unknown[] = []
  ): Promise<PgQueryResult<T>> {
    if (!this.isConfigured || this.closed) {
      throw new Error('PostgreSQL pool is not configured or has been closed.');
    }

    const start = Date.now();
    let attempt = 0;
    const maxAttempts = 2;

    while (true) {
      attempt += 1;
      try {
        const result = this.injectedQueryable
          ? await this.injectedQueryable.query<T>(sql, params)
          : await this.pool!.query<T>(sql, params);

        const elapsed = Date.now() - start;
        if (elapsed >= this.slowQueryMs) {
          logStructured('warn', 'postgres_slow_query', {
            elapsedMs: elapsed,
            sqlPreview: sql.replace(/\s+/g, ' ').trim().slice(0, 140),
          });
        }
        return result;
      } catch (err) {
        if (attempt < maxAttempts && isTransientPgError(err)) {
          await new Promise((r) => setTimeout(r, 120 * attempt));
          continue;
        }
        throw err;
      }
    }
  }

  async withTransaction<T>(
    fn: (client: PgQueryable) => Promise<T>,
    principal?: TransactionPrincipalContext
  ): Promise<T> {
    if (!this.isConfigured || this.closed) {
      throw new Error('PostgreSQL pool is not configured or has been closed.');
    }

    const applyPrincipal = async (tx: PgQueryable) => {
      if (principal?.userId) {
        await tx.query("SELECT set_config('app.current_user_id', $1, true)", [principal.userId]);
      }
      if (principal?.role) {
        await tx.query("SELECT set_config('app.current_role', $1, true)", [principal.role]);
      }
    };

    if (this.injectedQueryable) {
      await this.injectedQueryable.query('BEGIN');
      try {
        await applyPrincipal(this.injectedQueryable);
        const out = await fn(this.injectedQueryable);
        await this.injectedQueryable.query('COMMIT');
        return out;
      } catch (err) {
        await this.injectedQueryable.query('ROLLBACK').catch(() => undefined);
        throw err;
      }
    }

    const client: PoolClient = await this.pool!.connect();
    try {
      await client.query('BEGIN');
      if (this.statementTimeoutMs > 0) {
        await client.query("SELECT set_config('statement_timeout', $1, true)", [
          String(this.statementTimeoutMs),
        ]);
      }
      await applyPrincipal(client);
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<{ ok: boolean; configured: boolean; latencyMs?: number; error?: string }> {
    if (!this.isConfigured || this.closed) {
      return {
        ok: false,
        configured: false,
        error: 'DATABASE_URL not configured.',
      };
    }
    const start = Date.now();
    try {
      await this.query('SELECT 1 AS ok');
      return { ok: true, configured: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return {
        ok: false,
        configured: true,
        latencyMs: Date.now() - start,
        error: err?.message || 'PostgreSQL ping failed',
      };
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.pool) {
      await this.pool.end().catch(() => undefined);
    }
  }
}

export type ActiveDatabaseProvider = 'postgres' | 'supabase' | 'local_dev';

export function resolveConfiguredDatabaseProvider(env: NodeJS.ProcessEnv = process.env): ActiveDatabaseProvider {
  const explicit = (env.DATABASE_PROVIDER || 'auto').trim().toLowerCase();
  const hasDatabaseUrl = Boolean(
    (env.DATABASE_URL || '').trim() && !(env.DATABASE_URL || '').includes('postgres://user:pass@host')
  );
  const hasSupabase = Boolean(
    (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim() &&
      (env.SUPABASE_SERVICE_ROLE_KEY || '').trim() &&
      !(env.SUPABASE_URL || '').includes('your-ompnetwork-id')
  );

  if (explicit === 'postgres' || explicit === 'postgresql' || explicit === 'railway') {
    return 'postgres';
  }
  if (explicit === 'supabase') {
    return 'supabase';
  }
  if (hasDatabaseUrl) {
    return 'postgres';
  }
  if (hasSupabase) {
    return 'supabase';
  }
  return 'local_dev';
}
