import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface RateLimitResult {
  allowed: boolean;
  currentHits: number;
  remaining: number;
  backend: 'postgres_distributed' | 'memory_bounded';
}

export interface RateLimitBackend {
  checkAndIncrement(bucketKey: string, windowMs: number, maxHits: number): Promise<RateLimitResult>;
}

/**
 * Shared PostgreSQL-backed distributed rate limiter for multi-replica Railway deployments.
 * Calls atomic `public.check_and_increment_rate_limit(bucket_key, window_ms, max_hits)` RPC
 * from Migration 004 when Supabase service_role credentials are configured, with bounded
 * sliding-window fallback for local/unconfigured environments.
 */
export class DistributedRateLimiter {
  private readonly localStore = new Map<string, number[]>();
  private readonly supabase: SupabaseClient | null;
  private readonly maxLocalKeys: number;

  constructor(
    private readonly namespace: string,
    private readonly windowMs: number,
    private readonly maxRequests: number,
    options?: {
      maxLocalKeys?: number;
      supabaseClient?: SupabaseClient | null;
      customBackend?: RateLimitBackend;
    }
  ) {
    this.maxLocalKeys = options?.maxLocalKeys ?? 5000;
    this.customBackend = options?.customBackend;

    if (options?.supabaseClient !== undefined) {
      this.supabase = options.supabaseClient;
    } else {
      const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
      const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
      this.supabase =
        url && key && !url.includes('your-ompnetwork-id')
          ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
          : null;
    }
  }

  private readonly customBackend?: RateLimitBackend;

  public get mode(): 'postgres_distributed' | 'memory_bounded' {
    return this.customBackend || this.supabase ? 'postgres_distributed' : 'memory_bounded';
  }

  public checkLocal(key: string): RateLimitResult {
    const bucketKey = `${this.namespace}:${key}`;
    const now = Date.now();
    if (!this.localStore.has(bucketKey) && this.localStore.size >= this.maxLocalKeys) {
      for (const [k, timestamps] of this.localStore.entries()) {
        const active = timestamps.filter((ts) => now - ts < this.windowMs);
        if (active.length === 0) this.localStore.delete(k);
        if (this.localStore.size < this.maxLocalKeys) break;
      }
      if (this.localStore.size >= this.maxLocalKeys) {
        const oldest = this.localStore.keys().next().value;
        if (oldest) this.localStore.delete(oldest);
      }
    }
    const recent = (this.localStore.get(bucketKey) || []).filter((ts) => now - ts < this.windowMs);
    if (recent.length >= this.maxRequests) {
      this.localStore.set(bucketKey, recent);
      return {
        allowed: false,
        currentHits: recent.length,
        remaining: 0,
        backend: 'memory_bounded',
      };
    }
    recent.push(now);
    this.localStore.set(bucketKey, recent);
    return {
      allowed: true,
      currentHits: recent.length,
      remaining: Math.max(0, this.maxRequests - recent.length),
      backend: 'memory_bounded',
    };
  }

  /**
   * Synchronous check for routes that cannot await (uses bounded local store).
   */
  public check(key: string): boolean {
    return this.checkLocal(key).allowed;
  }

  /**
   * Distributed check across replicas via PostgreSQL atomic RPC (or injected backend).
   */
  public async checkDistributed(key: string): Promise<RateLimitResult> {
    const bucketKey = `${this.namespace}:${key}`;
    if (this.customBackend) {
      return this.customBackend.checkAndIncrement(bucketKey, this.windowMs, this.maxRequests);
    }
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.rpc('check_and_increment_rate_limit', {
          p_bucket_key: bucketKey,
          p_window_ms: this.windowMs,
          p_max_hits: this.maxRequests,
        });
        const row = Array.isArray(data) ? data[0] : data;
        if (!error && row && typeof row.allowed === 'boolean') {
          return {
            allowed: row.allowed,
            currentHits: Number(row.current_hits || 0),
            remaining: Number(row.remaining || 0),
            backend: 'postgres_distributed',
          };
        }
      } catch {
        // Fall through to bounded local enforcement so rate limiting never fails open
      }
    }
    return this.checkLocal(key);
  }
}
