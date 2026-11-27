# OPHIREUM NETWORK — BACKUP, RESTORATION, ROLLBACK & DR RUNBOOK

> **Scope**: PostgreSQL (Supabase Migrations `000`–`006`), Private Storage Buckets, Railway Compiled Backend (`dist/server/index.mjs`), GitHub Pages Frontend, Secret Rotation, and Incident Escalation.

## 1. Recovery Objectives (Target Baseline)
- **RPO (Recovery Point Objective)**: `<= 15 minutes` (Supabase Point-in-Time Recovery / WAL archiving enabled on Pro tier; daily automated logical snapshots on baseline tier).
- **RTO (Recovery Time Objective)**: `<= 60 minutes` for database restore + Railway immutable deployment rollback.

## 2. Verified Local PostgreSQL 16 (PGlite) DR Drill Evidence (Phase 44)
- **Automated Test**: `tests/postgres-migrations.test.ts` — *executes a real PostgreSQL 16 (PGlite) logical backup, SHA-256 checksum verification, and clean DR restore into a fresh instance*.
- **Verified Steps**:
  1. Seeded representative multi-table records in Primary PostgreSQL 16 Instance A (`auth.users`, `profiles`, `orders`, `financial_maker_checker_approvals`, `legal_policy_acceptances`).
  2. Exported deterministic logical backup snapshot and computed 64-hex SHA-256 integrity checksum.
  3. Bootstrapped clean Recovery PostgreSQL 16 Instance B with full migration chain `000`–`006`.
  4. Verified backup SHA-256 checksum prior to restore, replayed all records, and asserted 100% post-restore row-count and field parity.
- **Remaining Staging DR Gate**: Execute an equivalent `pg_dump` -> `pg_restore` drill against an isolated live Supabase staging project prior to production cutover.

## 3. Production Database Backup & Restoration Procedure
1. **Pre-Migration Snapshot (Mandatory)**:
   - Before applying any migration (`000`–`006` or future `007+`), capture a Supabase backup snapshot AND export logical dump:
     `pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > ophireum-pre-migration-$(date -u +%Y%m%dT%H%M%SZ).dump`
   - Record `sha256sum` of the `.dump` artifact.
2. **Staging Restoration Verification**:
   - Restore `.dump` into disposable staging DB: `pg_restore --clean --if-exists --no-owner -d "$STAGING_DATABASE_URL" <file.dump>`.
   - Verify row counts, `prevent_audit_log_mutation()` append-only triggers on `audit_logs`, `ai_session_events`, and `auth_security_events`, `chk_maker_checker_distinct_actors`, 6 private buckets (`public = false`), and `payment_reference_sequences` alignment.

## 4. Application Deployment Rollback & Graceful Draining
- **Railway Backend Rollback (`railway.json`, `node dist/server/index.mjs`)**:
  1. Select previous verified immutable deployment artifact in Railway and click **Rollback**.
  2. During `SIGTERM`, `server.ts` transitions `runtimeLifecycle.markDraining()`, shifting `GET /api/ready` to `503 temporarily_unavailable` while draining in-flight requests cleanly before exit code `0`.
  3. Confirm post-rollback `GET https://api.ophireummultimedia.com/api/health`, `/api/ready` (`200`), and `/api/version`.
- **GitHub Pages Frontend Rollback**:
  - Revert release commit on `main` via `git revert <release_sha>` and push to trigger `.github/workflows/deploy-pages.yml`.
- **Database Migration Policy**:
  - Migrations `000`–`006` are strictly additive and idempotent. Never run destructive `DROP TABLE` rollbacks on production; roll forward or restore from pre-migration snapshot.

## 5. Emergency Secret Rotation & Payment Incident Lockout
- Follow `docs/development/INCIDENT_RESPONSE_RUNBOOK.md` for `ADMIN_SESSION_SECRET`, `MFA_ENCRYPTION_KEY` (`enc:v2:<kid>` zero-downtime key rotation), `SUPABASE_SERVICE_ROLE_KEY`, and provider credential revocation.
- `live_payments_enabled` remains hard-locked `false` in migrations `003`/`004` and blocked (`403`) on `PUT /api/admin/config`.
