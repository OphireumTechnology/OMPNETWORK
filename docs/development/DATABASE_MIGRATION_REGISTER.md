# OPHIREUM NETWORK (`OMPNETWORK`) — Database Migration Register

**Schema Policy**: Strictly append-only migrations. Historical migrations `000`–`005` are never rewritten; all Phases 31–46 schema additions live cleanly in Migration `006`.

## Clean-Room & Upgrade Execution Order

Execute migrations sequentially against a blank or existing Supabase PostgreSQL 16+ instance:

1. `supabase/migrations/000_baseline_core_schema.sql` — Idempotent clean-room baseline tables (`client_profiles`, `ai_conversation_sessions`, `project_requirements`, `project_briefs`, `consultation_appointments`, `notification_records`, `consent_records`, `audit_logs`); zero `USING (true)`.
2. `supabase/migrations/001_phase1_security_and_persistence.sql` — Phase 1 stabilization (`solution_requests`, `admin_users`, appointment slot locking, `email_outbox`).
3. `supabase/migrations/002_client_portal_commerce.sql` — Client Portal commercial tables (`profiles`, `orders`, `invoices`, `payments`, `payment_webhook_events`, `credit_wallets`, `subscriptions`, `client_projects`, `support_tickets`, `portal_files`, `portal_notifications`).
4. `supabase/migrations/003_enterprise_platform_expansion.sql` — 9-role RBAC expansion, UUID-only admin helpers, append-only `audit_logs` trigger (`trg_audit_logs_immutable`), atomic `allocate_ophireum_payment_ref()`, 25 AI workforce/knowledge tables, `background_jobs`, `system_configurations` (`live_payments_enabled = false`), and 6 private Supabase Storage buckets (`public = false`).
5. `supabase/migrations/004_reconciliation_hardening.sql` — Idempotent reconciliation hardening, `revoked_session_tokens`, `distributed_rate_limit_buckets` + `check_and_increment_rate_limit()` RPC, `mfa_credentials`, `mfa_recovery_codes`, `SECURITY DEFINER` `SET search_path = public, pg_temp` lock.
6. `supabase/migrations/005_ai_conversation_persistence.sql` — Durable cross-replica AI conversation tables (`ai_conversation_sessions`, `ai_conversation_messages`, `ai_voice_sessions`, `ai_session_events`, `ai_session_usage`, `ai_session_checkpoints`), atomic `append_ai_conversation_message()` RPC (optimistic concurrency + deduplication), zero raw audio `CHECK` constraints, append-only `ai_session_events` trigger, and `ai_knowledge_chunks` 768-dim vector/metadata columns + conditional `pgvector` HNSW index.
7. `supabase/migrations/006_enterprise_reliability_and_ai_memory.sql` — **17 new enterprise tables & 1 hardened RPC (60+ total public tables)**:
   - **Phase 32 AI Memory & Privacy**: `ai_conversations`, `ai_conversation_participants`, `ai_conversation_summaries`, `ai_conversation_memory`, `ai_conversation_consents`, `ai_conversation_attachments`, `ai_conversation_retention_jobs`.
   - **Phase 33 Distributed Auth**: `auth_security_events` (append-only trigger `trg_auth_security_events_append_only`), `auth_lockouts`, `mfa_challenges`.
   - **Phase 34 Financial Governance**: `financial_maker_checker_approvals` (`CHECK (approver_email IS NULL OR lower(approver_email) <> lower(requested_by_email))`), `payment_reconciliation_queue`, `payment_settlement_records`, `payment_disputes`.
   - **Phase 36 Knowledge Quarantine**: `quarantined`, `quarantine_reason`, `sensitive_flags_count` on `ai_knowledge_documents`; `retrieval_eligible` on `ai_knowledge_chunks`.
   - **Phase 37 Workforce Job Queue**: `ai_workforce_job_queue`, `ai_workforce_dead_letters`, `claim_ai_workforce_job()` (`SECURITY DEFINER`, `SET search_path = public, pg_temp`, `FOR UPDATE SKIP LOCKED`, restricted to `service_role`).
   - **Phase 46 Legal Governance**: `legal_policy_acceptances` (versioned RA 10173 / RA 11967 records with owner-only RLS).

## Verification Status
- **Real PostgreSQL 16 (PGlite) Migration Chain `000`–`006`, Idempotency, RLS, `SECURITY DEFINER`, Maker-Checker DB Constraint & Logical DR Restore Drill**: `COMPLETE_VERIFIED` (**10/10 real PostgreSQL 16 tests passing** in `tests/postgres-migrations.test.ts`).
- **Live Staging Supabase Database Apply**: `BLOCKED_EXTERNAL_DEPENDENCY` (requires isolated Supabase staging credentials).
- **Production Database Apply**: `OWNER_APPROVAL_REQUIRED` (prohibited until staging verification, backup snapshot, and explicit Owner sign-off).
