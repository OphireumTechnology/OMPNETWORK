# OPHIREUM NETWORK — BACKUP, RESTORATION, ROLLBACK & DR RUNBOOK

> **Scope**: Native Railway PostgreSQL 16 & Supabase Transition (Migrations `000`–`007`), Private Storage Buckets, Railway Compiled Backend (`dist/server/index.mjs`), GitHub Pages Frontend, Secret Rotation, and Incident Escalation.

## 1. Recovery Objectives (Target Baseline)
- **RPO (Recovery Point Objective)**: `<= 15 minutes` (managed PostgreSQL WAL / PITR when enabled; daily automated logical snapshots on baseline tier).
- **RTO (Recovery Time Objective)**: `<= 60 minutes` for database restore + Railway immutable deployment rollback.

## 2. Verified Local PostgreSQL 16 (PGlite) DR Drill Evidence (Phases 44 & 51)
- **Automated Tests**: `tests/postgres-migrations.test.ts` and `tests/native-postgres-integration.test.ts`.
- **Verified Steps**:
  1. Seeded representative multi-table records in Primary PostgreSQL 16 Instance A (`auth.users`, `profiles`, `orders`, `financial_maker_checker_approvals`, `legal_policy_acceptances`).
  2. Exported deterministic logical backup snapshot and computed 64-hex SHA-256 integrity checksum.
  3. Bootstrapped clean Recovery PostgreSQL 16 Instance B with full migration chain `000`–`007` (also verified via advisory-locked `scripts/run-migrations.mjs` with SHA-256 tamper rejection).
  4. Verified backup SHA-256 checksum prior to restore, replayed all records, and asserted 100% post-restore row-count and field parity.
- **Remaining Staging DR Gate**: Execute an equivalent `pg_dump` -> `pg_restore` drill against an isolated live Railway PostgreSQL staging instance prior to production cutover.

## 3. Production Database Backup & Restoration Procedure
1. **Pre-Migration Snapshot (Mandatory)**:
   - Before applying any migration (`000`–`007` or future `008+`), capture a managed Railway/Supabase backup snapshot AND export logical dump:
     - PowerShell: `pg_dump --format=custom --no-owner --no-privileges "$env:DATABASE_URL" --file="ophireum-pre-migration.dump"`
   - Record SHA-256 checksum (`Get-FileHash ophireum-pre-migration.dump -Algorithm SHA256`).
2. **Staging Restoration Verification**:
   - Restore `.dump` into disposable staging DB: `pg_restore --clean --if-exists --no-owner -d "$env:STAGING_DATABASE_URL" ophireum-pre-migration.dump`.
   - Run `npm run db:migrate:dry-run` to confirm `schema_migrations` checksum alignment (`000`–`007`).
   - Verify row counts (`docs/development/DATA_RECONCILIATION_REPORT.md`), `prevent_audit_log_mutation()` append-only triggers on `audit_logs`, `ai_session_events`, and `auth_security_events`, `chk_maker_checker_distinct_actors`, 6 private buckets (`public = false`), and `payment_reference_sequences` alignment.

## 4. Application Deployment Rollback & Graceful Draining
- **Railway Backend Rollback (`railway.json`, Railpack, `node dist/server/index.mjs`)**:
  1. Select previous verified immutable deployment artifact in Railway and click **Rollback**.
  2. During `SIGTERM`, `server.ts` transitions `runtimeLifecycle.markDraining()`, shifting `GET /api/ready` to `503 temporarily_unavailable`, draining in-flight requests, and closing `PostgresPoolManager.close()` cleanly before exit code `0`.
  3. Confirm post-rollback `GET https://api.ophireummultimedia.com/api/health`, `/api/ready` (`200`), and `/api/version`.
- **GitHub Pages Frontend Rollback**:
  - Revert release commit on `main` via `git revert <release_sha>` and push to trigger `.github/workflows/deploy-pages.yml`.
- **Database Migration Policy**:
  - Migrations `000`–`007` are strictly additive and idempotent. Never run destructive `DROP TABLE` rollbacks on production; roll forward or restore from pre-migration snapshot.

## 5. Emergency Secret Rotation & Payment Incident Lockout
- Follow `docs/development/INCIDENT_RESPONSE_RUNBOOK.md` for `ADMIN_SESSION_SECRET`, `MFA_ENCRYPTION_KEY` (`enc:v2:<kid>` zero-downtime key rotation), `SUPABASE_SERVICE_ROLE_KEY`, and provider credential revocation.
- `live_payments_enabled` remains hard-locked `false` in migrations `003`/`004` and blocked (`403`) on `PUT /api/admin/config`.
