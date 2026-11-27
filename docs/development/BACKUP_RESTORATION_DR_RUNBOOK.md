# OPHIREUM NETWORK — BACKUP, RESTORATION, ROLLBACK & DR RUNBOOK (SECTION 22)

> **Scope**: PostgreSQL (Supabase), Private Storage Buckets, Railway Backend API, GitHub Pages Frontend, Secret Rotation, and Incident Escalation.

## 1. Recovery Objectives (Target Baseline)
- **RPO (Recovery Point Objective)**: `<= 15 minutes` (Supabase Point-in-Time Recovery / WAL archiving enabled on Pro tier; daily automated logical snapshots on baseline tier).
- **RTO (Recovery Time Objective)**: `<= 60 minutes` for database restore + Railway service rollback.

## 2. Automated Database Backup & Restoration Procedure
1. **Pre-Migration Snapshot (Mandatory)**:
   - Before running any migration (`000`–`004` or future `005+`), capture a manual Supabase backup snapshot AND export logical backup:
     `pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" > ophireum-pre-migration-$(date -u +%Y%m%dT%H%M%SZ).dump`
2. **Staging Restoration Drill (Required Before Production Cutover)**:
   - Restore the latest `.dump` into a disposable staging database using `pg_restore --clean --if-exists --no-owner`.
   - Verify row counts across `profiles`, `orders`, `payments`, `payment_reference_sequences`, `audit_logs`, `ai_agent_executions`, and `knowledge_documents`.
   - Confirm append-only triggers (`prevent_audit_log_mutation`) and `storage.objects` RLS policies remain active after restore.
   - Verify `payment_reference_sequences.last_sequence` matches `MAX(sequence)` in `payments` so no payment reference collisions occur after restore.

## 3. Private Storage Bucket Backup & Recovery
- All 6 private buckets (`customer-uploads`, `digital-products`, `project-deliverables`, `invoices-pdf`, `receipts-pdf`, `business-documents`) must remain `public = false`.
- Schedule encrypted weekly mirror sync of storage objects to secondary cold object storage (e.g., encrypted S3/GCS bucket) preserving exact `{userId}/...` key prefixes.

## 4. Application Deployment Rollback Procedure
- **Railway Backend Rollback**:
  1. In Railway Dashboard -> Deployments -> select the previous healthy immutable deployment artifact and click **Redeploy / Rollback**.
  2. Verify `GET https://api.ophireummultimedia.com/api/health` returns `200 OK` with `"storageMode": "supabase"`.
- **GitHub Pages Frontend Rollback**:
  1. Revert the release commit on `main` via `git revert <release_sha>` and push to trigger the standard GitHub Pages workflow.
- **Database Migration Rollback Policy**:
  - Migrations `000`–`004` are strictly additive and idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`). Never run destructive `DROP TABLE` rollbacks on production; instead roll forward with a corrective migration or restore from pre-migration snapshot if data corruption occurs.

## 5. Emergency Secret Rotation & Compromise Containment
1. **Session / Auth Secret Compromise (`ADMIN_SESSION_SECRET`, `MFA_ENCRYPTION_KEY`)**:
   - Rotate `ADMIN_SESSION_SECRET` in Railway immediately (invalidates all signed admin/portal bearer & cookie tokens across all replicas).
   - Re-encrypt or re-enroll admin TOTP credentials if `MFA_ENCRYPTION_KEY` was exposed.
   - Truncate/expire active sessions and audit `public.audit_logs` and `public.admin_activity_logs`.
2. **Database Service Role Key Compromise (`SUPABASE_SERVICE_ROLE_KEY`)**:
   - Rotate service role key in Supabase Project Settings -> API immediately and update Railway environment variable + restart all replicas.
3. **Provider Key Compromise (`GEMINI_API_KEY`, `RESEND_API_KEY`, Payment Webhook Secrets)**:
   - Revoke compromised key in provider console, generate replacement, update Railway env vars, and verify via `/api/admin/integrations/health`.

## 6. Payment Incident Lockout
- `live_payments_enabled` is hard-locked `false` in database migration `003`/`004` and blocked from runtime API mutation (`403` in `PUT /api/admin/config`).
- If any payment webhook anomaly occurs after future live activation, disable webhook processing via provider console and inspect `payment_webhook_events` for duplicate or mismatched amounts before re-enabling.
