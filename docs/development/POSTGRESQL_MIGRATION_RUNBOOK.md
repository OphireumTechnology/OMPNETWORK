# OPHIREUM NETWORK — POSTGRESQL MIGRATION RUNBOOK (PHASES 50–54)

**Migration Direction:** Supabase PostgreSQL → Native Railway PostgreSQL 16 (`DATABASE_URL` + `pg`)  
**Migration Chain:** `000_baseline_core_schema.sql` through `007_native_postgresql_runtime_support.sql`  
**Runner:** `scripts/run-migrations.mjs` (`npm run db:migrate`)

---

## 1. Architecture Transition Summary

OPHIREUM NETWORK supports both **Native Railway PostgreSQL (`DATABASE_PROVIDER=postgres`)** and **Supabase (`DATABASE_PROVIDER=supabase`)** during controlled transition:

| Layer | Native Railway PostgreSQL | Supabase (Transition Fallback) |
|---|---|---|
| Core DB Repo | `src/server/db/postgresRepository.ts` (`PostgresDatabaseRepository`) | `src/server/db/supabaseRepository.ts` |
| Client Portal & Admin Repo | `src/server/portal/postgresPortalRepository.ts` (`PostgresPortalRepository`) | `src/server/portal/supabasePortalRepository.ts` |
| AI Conversation Store | `src/server/ai/postgresConversationStore.ts` (`PostgresAiConversationStore`) | `src/server/ai/supabaseConversationStore.ts` |
| Connection Pool & RLS Tx | `src/server/db/postgresPool.ts` (`PostgresPoolManager`) | `@supabase/supabase-js` HTTP REST client |
| Schema Migrations | `supabase/migrations/000`–`007` via `scripts/run-migrations.mjs` | Supabase CLI / SQL Editor |

---

## 2. Pre-Migration Preparation

1. Provision an isolated **Railway PostgreSQL 16** instance (prefer `pgvector/pgvector:pg16` if enabling SQL vector similarity indexing).
2. Confirm automated daily backups and point-in-time recovery (PITR) are enabled on the target database.
3. Verify schema migration dry-run against the fresh target database:
   ```powershell
   $env:DATABASE_URL = "<TARGET_RAILWAY_POSTGRES_URL>"
   npm run db:migrate:dry-run
   ```
4. Apply Migrations `000`–`007`:
   ```powershell
   npm run db:migrate
   ```
   The runner automatically:
   - Acquires PostgreSQL advisory lock `7567003` (prevents multi-replica startup races).
   - Creates standalone `auth` / `storage` compatibility shims if absent (`auth.users`, `auth.uid()`, `auth.role()`, `auth.jwt()`, `storage.buckets`, `storage.objects`, `storage.foldername()`).
   - Records SHA-256 checksums in `public.schema_migrations` and halts with `MIGRATION_CHECKSUM_MISMATCH` if any previously applied migration file was altered.

---

## 3. Data Export & Import From Existing Supabase Staging/Production

### Step A — Export Schema-Compatible Data Only (`--data-only`)
```powershell
pg_dump "$env:SUPABASE_DIRECT_DB_URL" `
  --data-only `
  --no-owner `
  --no-privileges `
  --schema=public `
  --exclude-table=public.schema_migrations `
  --file=".\ophireum-export-data.sql"

Get-FileHash ".\ophireum-export-data.sql" -Algorithm SHA256
```

### Step B — Import Into Target Railway PostgreSQL
```powershell
psql "$env:RAILWAY_DATABASE_URL" -v ON_ERROR_STOP=1 -f ".\ophireum-export-data.sql"
```

### Step C — Sequence Synchronization
Reset any serial/sequence counters and verify `payment_reference_sequences` matches source counts before opening write traffic.

---

## 4. Cutover Checklist (Zero-Data-Loss Window)

1. Enable short maintenance freeze on existing write endpoints (if migrating live data).
2. Run final incremental `pg_dump` / `psql` sync.
3. Execute reconciliation queries documented in `docs/development/DATA_RECONCILIATION_REPORT.md` (row counts, order totals, payment totals, audit log counts, AI conversation message counts).
4. Update Railway `OMPNETWORK` service variables:
   - `DATABASE_PROVIDER=postgres`
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
5. Deploy `1.0.0-rc.2` and verify `/api/health` reports:
   - `database.provider: "postgres"`
   - `database.healthy: true`
   - `portalStorage: "postgres"`
   - `aiConversationBackend: "postgres_native"`
6. Run smoke verification (registration, login, cart, checkout, admin login, AI chat) on staging before any production cutover.

---

## 5. Rollback Procedure

If an unexpected regression occurs during controlled staging or production cutover:
1. Keep Supabase read-only snapshot intact for 30 days post-cutover.
2. To revert immediately prior to post-cutover writes, set `DATABASE_PROVIDER=supabase` with valid `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and redeploy the previous Railway snapshot.
3. Never drop or truncate tables on either database during rollback investigation.
