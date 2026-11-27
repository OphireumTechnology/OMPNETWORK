#!/usr/bin/env node
/**
 * OPHIREUM NETWORK — Standalone PostgreSQL Migration Runner (Phase 51)
 *
 * Applies supabase/migrations/000_*.sql .. 007_*.sql safely against any native
 * PostgreSQL 15/16 server (including Railway PostgreSQL via DATABASE_URL):
 *  - Acquires PostgreSQL session advisory lock (7567003) to prevent concurrent races
 *  - Bootstraps Supabase-compatible `auth` & `storage` shims ONLY if missing on standalone PG
 *  - Verifies SHA-256 checksums of already-applied migrations in public.schema_migrations
 *  - Executes each pending migration inside an explicit BEGIN / COMMIT transaction
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase', 'migrations');
const ADVISORY_LOCK_KEY = 7567003; // OPHIREUM DTI Registration Number

const STANDALONE_COMPAT_SHIM = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_val TEXT;
BEGIN
  v_val := NULLIF(BTRIM(current_setting('app.current_user_id', true)), '');
  IF v_val IS NOT NULL THEN
    RETURN v_val::UUID;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(BTRIM(current_setting('app.current_role', true)), ''), current_user);
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'sub', COALESCE(current_setting('app.current_user_id', true), ''),
    'role', COALESCE(NULLIF(BTRIM(current_setting('app.current_role', true)), ''), 'authenticated')
  );
$$;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN NOT NULL DEFAULT FALSE,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL REFERENCES storage.buckets(id),
  name TEXT NOT NULL,
  owner UUID,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  -- Managed PostgreSQL roles without CREATEROLE privilege skip role creation cleanly
  NULL;
END $$;
`;

export function listMigrationFiles(dir = MIGRATIONS_DIR) {
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort()
    .map((filename) => {
      const fullPath = path.join(dir, filename);
      const sql = fs.readFileSync(fullPath, 'utf8');
      const sha256 = crypto.createHash('sha256').update(sql, 'utf8').digest('hex');
      const version = filename.slice(0, 3);
      return { version, filename, fullPath, sql, sha256 };
    });
}

async function execMultiStatement(queryable, sql) {
  if (typeof queryable.exec === 'function') {
    await queryable.exec(sql);
    return;
  }
  await queryable.query(sql);
}

export async function applyMigrationsWithQueryable(queryable, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const migrations = listMigrationFiles(options.migrationsDir || MIGRATIONS_DIR);

  await queryable.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
  const applied = [];
  const skipped = [];

  try {
    // Ensure standalone PostgreSQL compatibility schemas exist if not running on Supabase
    const { rows: authCheck } = await queryable.query(
      "SELECT to_regclass('auth.users') AS auth_users, to_regclass('storage.buckets') AS storage_buckets"
    );
    if (!authCheck[0]?.auth_users || !authCheck[0]?.storage_buckets) {
      await execMultiStatement(queryable, STANDALONE_COMPAT_SHIM);
    }

    await execMultiStatement(
      queryable,
      `
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version TEXT PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        sha256_checksum TEXT NOT NULL,
        applied_by TEXT NOT NULL DEFAULT current_user,
        execution_ms INTEGER NOT NULL DEFAULT 0,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    );

    const { rows: existingRows } = await queryable.query(
      'SELECT version, filename, sha256_checksum FROM public.schema_migrations ORDER BY version ASC'
    );
    const existingByVersion = new Map(existingRows.map((r) => [String(r.version), r]));

    for (const mig of migrations) {
      const prev = existingByVersion.get(mig.version);
      if (prev) {
        if (prev.sha256_checksum !== mig.sha256) {
          throw new Error(
            `MIGRATION_CHECKSUM_MISMATCH: ${mig.filename} expected ${prev.sha256_checksum}, found ${mig.sha256}`
          );
        }
        skipped.push(mig.filename);
        continue;
      }

      if (dryRun) {
        applied.push(`${mig.filename} (dry-run)`);
        continue;
      }

      const start = Date.now();
      await queryable.query('BEGIN');
      try {
        await execMultiStatement(queryable, mig.sql);
        const durationMs = Date.now() - start;
        await queryable.query(
          `INSERT INTO public.schema_migrations (version, filename, sha256_checksum, execution_ms)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (version) DO NOTHING`,
          [mig.version, mig.filename, mig.sha256, durationMs]
        );
        await queryable.query('COMMIT');
        applied.push(mig.filename);
      } catch (err) {
        await queryable.query('ROLLBACK').catch(() => undefined);
        throw new Error(`Migration ${mig.filename} failed and was rolled back: ${err?.message || String(err)}`);
      }
    }

    return { applied, skipped, totalMigrations: migrations.length };
  } finally {
    await queryable.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => undefined);
  }
}

async function main() {
  const connectionString = (process.env.DATABASE_URL || '').trim();
  const dryRun = process.argv.includes('--dry-run');
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is required to execute PostgreSQL migrations.');
    process.exit(1);
  }

  const ssl =
    process.env.DATABASE_SSL === 'false' || /railway\.internal|localhost|127\.0\.0\.1/i.test(connectionString)
      ? false
      : { rejectUnauthorized: false };

  const client = new Client({ connectionString, ssl });
  await client.connect();
  try {
    const result = await applyMigrationsWithQueryable(client, { dryRun });
    console.log(JSON.stringify({ ok: true, dryRun, ...result }, null, 2));
  } finally {
    await client.end();
  }
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
