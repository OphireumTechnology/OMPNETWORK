# OPHIREUM NETWORK (`OMPNETWORK`) — Database Migration Register

## Clean-Room Execution Order

Execute migrations sequentially against a blank or existing Supabase PostgreSQL instance:

1. `supabase/migrations/000_baseline_core_schema.sql`
   - **Purpose**: Idempotent clean-room baseline tables required before `001` (`client_profiles`, `ai_conversation_sessions`, `project_requirements`, `project_briefs`, `consultation_appointments`, `notification_records`, `consent_records`, `audit_logs`).
   - **RLS**: Enabled on all tables; zero permissive `USING (true)` policies.
2. `supabase/migrations/001_phase1_security_and_persistence.sql`
   - **Purpose**: Phase 1 stabilization tables (`solution_requests`, `admin_users`, appointment slot locking, outbox enhancements).
3. `supabase/migrations/002_client_portal_commerce.sql`
   - **Purpose**: Client Portal commercial tables (`portal_profiles`, `portal_catalog`, `carts`, `orders`, `invoices`, `payments`, `payment_webhook_events`, `credit_wallets`, `subscriptions`, `client_projects`, `support_tickets`, `portal_files`, `portal_notifications`).
4. `supabase/migrations/003_enterprise_platform_expansion.sql`
   - **Purpose**:
     - Expands `admin_users.role` to 9 enterprise RBAC roles and hardens `is_ophireum_admin()` / `has_ophireum_admin_role(text[])` to UUID-only auth checks.
     - Adds append-only immutability trigger (`trg_audit_logs_immutable`) on `public.audit_logs`.
     - Adds atomic `payment_reference_sequences` + PL/pgSQL `allocate_ophireum_payment_ref(timestamptz)` (`Asia/Manila`, `MMDDYYYYHHMMAM/PMNNN`).
     - Creates enterprise tables: `roles`, `permissions`, `role_permissions`, `admin_sessions`, `security_events`, `customer_organizations`, `organization_members`, `promotions`, `promotion_redemptions`, `order_status_history`, `payment_refunds`, `digital_entitlements`, `digital_download_logs`, `project_tasks`, `ai_agents`, `ai_agent_executions`, `ai_knowledge_documents`, `ai_knowledge_chunks`, `ai_usage_records`, `ai_human_escalations`, `background_jobs` (+ `claim_next_background_job()` with `FOR UPDATE SKIP LOCKED`), `integration_health_records`, `system_configurations`, `legal_policy_versions`, `privacy_requests`.
     - Provisions 6 private Supabase Storage buckets (`customer-uploads`, `digital-products`, `project-deliverables`, `invoices-pdf`, `receipts-pdf`, `business-documents`) when `storage.buckets` exists.

## Verification Status
- **Static & Migration Integrity**: `COMPLETE_VERIFIED` (verified sequential files, zero `USING (true)`, PL/pgSQL functions present).
- **Live Staging Database Apply**: `BLOCKED_EXTERNAL_DEPENDENCY` (requires staging Supabase PostgreSQL connection string / credentials not present in this local sandbox).
- **Production Database Apply**: `OWNER_APPROVAL_REQUIRED` (strictly prohibited without staging verification and owner authorization).
