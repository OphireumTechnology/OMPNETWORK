# OPHIREUM NETWORK (`OMPNETWORK`) — Incident Response & Operational Escalation Runbook

**Owner / Executive Escalation**: Dhenze Languisan (Founder & CEO — OPHIREUM MULTIMEDIA PRODUCTION)  
**Production Targets**: `https://ophireummultimedia.com/` (GitHub Pages) · `https://api.ophireummultimedia.com/` (Railway) · Supabase PostgreSQL

---

## 1. Severity Classification & Initial Response SLA

| Severity | Definition | Target Ack | Containment Action |
|---|---|---|---|
| **SEV-1 (Critical)** | Production outage, credential/secret leak, unauthorized financial mutation, cross-tenant data exposure, or RLS bypass | <= 15 min | Immediate credential rotation, traffic isolation or rollback, executive notification |
| **SEV-2 (High)** | Degraded primary dependency (Supabase/Gemini/Resend circuit breaker `OPEN`), elevated 5xx rate (>2%), webhook verification spike | <= 30 min | Inspect `/api/health`, `/api/ready`, correlation IDs, and Railway/Supabase logs |
| **SEV-3 (Medium)** | Single non-critical provider outage (Calendar/TTS), AI workforce dead-letter accumulation, reconciliation mismatch | <= 4 hours | Triage `/api/ai/jobs` DLQ or `/api/admin/payments/reconciliation` queue |
| **SEV-4 (Low)** | Minor UI/styling defect or non-security log anomaly | <= 1 business day | Log defect in `DEFECT_REMEDIATION_REGISTER.md` and schedule patch |

## 2. Diagnostic Triage Playbook

1. **Check Runtime Health & Circuit Breakers**:
   - `GET https://api.ophireummultimedia.com/api/health` -> Inspect `status` (`healthy | degraded`), `components`, and `circuitBreakers.{supabase,gemini,resend,calendar,payments}`.
   - `GET https://api.ophireummultimedia.com/api/ready` -> Verify `ready: true` (`503 not_ready` indicates draining or unconfigured primary storage).
   - `GET https://api.ophireummultimedia.com/api/version` -> Confirm deployed commit SHA and Node 22 runtime version.
2. **Trace by Correlation ID**:
   - Every HTTP response includes `X-Request-Id`. Search structured JSON logs in Railway by `correlationId` (all secrets/PANs/JWTs are automatically redacted by `redactSensitiveText()`).
3. **Inspect Append-Only Security & Audit Logs**:
   - Query `public.audit_logs`, `public.auth_security_events`, and `public.ai_session_events` (all protected by PostgreSQL append-only triggers).

## 3. Containment Procedures by Scenario

### A. Suspected Credential or Session Compromise
1. Rotate `ADMIN_SESSION_SECRET` and `PORTAL_SIGNING_SECRET` in Railway immediately (globally invalidates all bearer tokens and HttpOnly session cookies across all replicas).
2. If `MFA_ENCRYPTION_KEY` is suspected compromised: set `MFA_ENCRYPTION_KEY_PREVIOUS` to the old key, set `MFA_ENCRYPTION_KEY` to a new 32+ byte secret, invoke `POST /api/admin/auth/mfa/rotate-key`, verify `rotatedCount`, then remove `MFA_ENCRYPTION_KEY_PREVIOUS`.
3. If `SUPABASE_SERVICE_ROLE_KEY` is compromised: regenerate immediately in Supabase Settings -> API and redeploy Railway.

### B. Payment Webhook Anomaly or Suspected Replay / Fraud
1. Confirm `live_payments_enabled` remains `false` (or disable webhook delivery in provider console if live payments were previously authorized).
2. Inspect `GET /api/admin/payments/reconciliation` and `public.payment_webhook_events` for unmatched orders, amount mismatches, or rejected timestamp windows.
3. Freeze any affected high-value refunds pending dual-control maker-checker review (`GET /api/admin/payments/maker-checker`).

### C. Sensitive Data Uploaded to Knowledge Base
1. Auto-quarantine triggers automatically for detected payment cards, private keys, and credentials.
2. For manual containment: invoke `POST /api/ai/knowledge/documents/:id/quarantine` (immediately strips chunks from retrieval and archives the document), then purge via `DELETE /api/ai/knowledge/documents/:id` after forensic capture.

### D. Railway Backend Rollback / Graceful Drain
1. Redeploy previous verified immutable release artifact in Railway.
2. Confirm `SIGTERM` draining shifts `/api/ready` to `503 not_ready` while in-flight requests drain cleanly before process exit.
3. For database recovery, execute `docs/development/BACKUP_RESTORATION_DR_RUNBOOK.md`.

## 4. Philippine Data Privacy Act (RA 10173) Breach Notification Rule
- If a confirmed personal data breach meets National Privacy Commission (NPC) mandatory notification criteria (NPC Circular 16-03), notify the NPC and affected data subjects within **72 hours** of knowledge/reasonable belief, coordinated with OPHIREUM legal counsel and the Data Protection Officer.
