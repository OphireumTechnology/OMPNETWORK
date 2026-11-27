-- ============================================================================
-- OPHIREUM NETWORK (OMPNETWORK)
-- Migration 007: Native Railway PostgreSQL Runtime & Governance Support
-- Append-only migration — preserves Migrations 000 through 006 untouched.
--
-- Enables 100% native PostgreSQL operation (Railway PostgreSQL via DATABASE_URL)
-- with full parity to Supabase while preserving Supabase Auth/Storage
-- compatibility during controlled migration.
-- ============================================================================

-- 1. Migration Version & SHA-256 Checksum Tracking Table (Phase 51)
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  sha256_checksum TEXT NOT NULL,
  applied_by TEXT NOT NULL DEFAULT current_user,
  execution_ms INTEGER NOT NULL DEFAULT 0,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Unified Transaction-Scoped Principal Helpers (works on BOTH Railway PG & Supabase)
CREATE OR REPLACE FUNCTION public.app_current_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_setting TEXT;
  v_uid UUID;
BEGIN
  v_setting := NULLIF(BTRIM(current_setting('app.current_user_id', true)), '');
  IF v_setting IS NOT NULL THEN
    BEGIN
      RETURN v_setting::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN NULL;
    END;
  END IF;

  BEGIN
    EXECUTE 'SELECT auth.uid()' INTO v_uid;
    RETURN v_uid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_current_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := NULLIF(BTRIM(current_setting('app.current_role', true)), '');
  IF v_role IS NOT NULL THEN
    RETURN v_role;
  END IF;
  RETURN current_user;
END;
$$;

REVOKE ALL ON FUNCTION public.app_current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_current_role() FROM PUBLIC;

-- 3. Native Standalone Portal Authentication Users (Preserves existing UUIDs)
CREATE TABLE IF NOT EXISTS public.portal_auth_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token_hash TEXT,
  verification_token_expires_at TIMESTAMPTZ,
  reset_token_hash TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  pending_email TEXT,
  pending_email_token_hash TEXT,
  pending_email_token_expires_at TIMESTAMPTZ,
  account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended', 'pending_closure', 'closed')),
  suspended_at TIMESTAMPTZ,
  suspension_reason TEXT,
  closure_requested_at TIMESTAMPTZ,
  mfa_state_json JSONB NOT NULL DEFAULT '{"enabled":false}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_auth_users_email_lower
  ON public.portal_auth_users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_portal_auth_users_verif_hash
  ON public.portal_auth_users (verification_token_hash)
  WHERE verification_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_portal_auth_users_reset_hash
  ON public.portal_auth_users (reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;

-- 4. Native Multi-Replica Client Portal Sessions
CREATE TABLE IF NOT EXISTS public.portal_auth_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.portal_auth_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_auth_sessions_user
  ON public.portal_auth_sessions (user_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_portal_auth_sessions_expires
  ON public.portal_auth_sessions (expires_at);

-- 5. Native Durable Portal State Tables (100% Repository Parity without JSON files)
CREATE TABLE IF NOT EXISTS public.portal_carts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'PHP')),
  discount_code TEXT,
  items_json JSONB NOT NULL DEFAULT '[]'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.portal_custom_inquiries (
  id UUID PRIMARY KEY,
  reference_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL,
  required_services_json JSONB NOT NULL DEFAULT '[]'::JSONB,
  estimated_monthly_volume TEXT NOT NULL DEFAULT '',
  project_description TEXT NOT NULL DEFAULT '',
  budget_range TEXT NOT NULL DEFAULT '',
  expected_schedule TEXT NOT NULL DEFAULT '',
  supporting_file_ids_json JSONB NOT NULL DEFAULT '[]'::JSONB,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'under_review', 'quoted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_custom_inquiries_user
  ON public.portal_custom_inquiries (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.portal_attachments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID,
  order_id UUID,
  ticket_id UUID,
  file_name TEXT NOT NULL,
  stored_file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  extension TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  category TEXT NOT NULL CHECK (
    category IN ('brief', 'reference', 'message_attachment', 'deliverable', 'support_attachment')
  ),
  version INTEGER NOT NULL DEFAULT 1,
  uploaded_by_role TEXT NOT NULL DEFAULT 'client' CHECK (uploaded_by_role IN ('client', 'team')),
  storage_key TEXT,
  content_bytea BYTEA,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_attachments_user_project
  ON public.portal_attachments (user_id, project_id, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS public.portal_activity_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  related_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_activity_logs_user
  ON public.portal_activity_logs (user_id, created_at DESC);

-- 6. Native JSON-Backed Snapshot Tables for Portal Domains with Complex Nested Structures
-- (Keeps full relational columns on core tables while guaranteeing zero loss of nested fields
--  like approval_history, timeline, billing_details, and organization members across replicas.)
CREATE TABLE IF NOT EXISTS public.portal_domain_records (
  domain TEXT NOT NULL,
  record_id TEXT NOT NULL,
  user_id TEXT,
  secondary_key TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (domain, record_id)
);

CREATE INDEX IF NOT EXISTS idx_portal_domain_records_user
  ON public.portal_domain_records (domain, user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_domain_records_secondary
  ON public.portal_domain_records (domain, secondary_key)
  WHERE secondary_key IS NOT NULL;

-- 7. Phase 58 AI Provider Reliability & Cost Governance Limits
CREATE TABLE IF NOT EXISTS public.ai_usage_governance_limits (
  scope_key TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'agent', 'tenant')),
  max_tokens_per_request INTEGER NOT NULL DEFAULT 8192 CHECK (max_tokens_per_request > 0),
  daily_spend_cap_usd NUMERIC(12, 4) NOT NULL DEFAULT 25.0000 CHECK (daily_spend_cap_usd >= 0),
  monthly_spend_cap_usd NUMERIC(12, 4) NOT NULL DEFAULT 500.0000 CHECK (monthly_spend_cap_usd >= 0),
  max_concurrent_executions INTEGER NOT NULL DEFAULT 10 CHECK (max_concurrent_executions > 0),
  emergency_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  suspension_reason TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.ai_usage_governance_limits (
  scope_key, scope_type, max_tokens_per_request, daily_spend_cap_usd, monthly_spend_cap_usd, max_concurrent_executions, emergency_suspended
)
VALUES ('global', 'global', 8192, 25.0000, 500.0000, 10, FALSE)
ON CONFLICT (scope_key) DO NOTHING;

-- 8. Strict Row-Level Security on All New Tables (Zero permissive wildcard policies)
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_auth_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_custom_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_domain_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_governance_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS portal_auth_users_owner_select ON public.portal_auth_users;
CREATE POLICY portal_auth_users_owner_select
  ON public.portal_auth_users FOR SELECT
  USING (id = public.app_current_user_id() OR public.app_current_role() IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS portal_auth_sessions_owner_select ON public.portal_auth_sessions;
CREATE POLICY portal_auth_sessions_owner_select
  ON public.portal_auth_sessions FOR SELECT
  USING (user_id = public.app_current_user_id() OR public.app_current_role() IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS portal_carts_owner_all ON public.portal_carts;
CREATE POLICY portal_carts_owner_all
  ON public.portal_carts FOR ALL
  USING (user_id = public.app_current_user_id() OR public.app_current_role() IN ('super_admin', 'admin'))
  WITH CHECK (user_id = public.app_current_user_id() OR public.app_current_role() IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS portal_custom_inquiries_owner_all ON public.portal_custom_inquiries;
CREATE POLICY portal_custom_inquiries_owner_all
  ON public.portal_custom_inquiries FOR ALL
  USING (user_id = public.app_current_user_id() OR public.app_current_role() IN ('super_admin', 'admin', 'sales_officer'))
  WITH CHECK (user_id = public.app_current_user_id() OR public.app_current_role() IN ('super_admin', 'admin', 'sales_officer'));

DROP POLICY IF EXISTS portal_attachments_owner_all ON public.portal_attachments;
CREATE POLICY portal_attachments_owner_all
  ON public.portal_attachments FOR ALL
  USING (user_id = public.app_current_user_id() OR public.app_current_role() IN ('super_admin', 'admin', 'project_manager', 'support_officer'))
  WITH CHECK (user_id = public.app_current_user_id() OR public.app_current_role() IN ('super_admin', 'admin', 'project_manager', 'support_officer'));

DROP POLICY IF EXISTS portal_activity_logs_owner_select ON public.portal_activity_logs;
CREATE POLICY portal_activity_logs_owner_select
  ON public.portal_activity_logs FOR SELECT
  USING (user_id = public.app_current_user_id() OR public.app_current_role() IN ('super_admin', 'admin', 'auditor'));

DROP POLICY IF EXISTS portal_domain_records_owner_all ON public.portal_domain_records;
CREATE POLICY portal_domain_records_owner_all
  ON public.portal_domain_records FOR ALL
  USING (
    user_id = public.app_current_user_id()::TEXT
    OR public.app_current_role() IN ('super_admin', 'admin', 'operations_manager', 'finance_officer', 'project_manager', 'support_officer', 'auditor')
  )
  WITH CHECK (
    user_id = public.app_current_user_id()::TEXT
    OR public.app_current_role() IN ('super_admin', 'admin', 'operations_manager', 'finance_officer', 'project_manager', 'support_officer')
  );

DROP POLICY IF EXISTS ai_usage_governance_admin_all ON public.ai_usage_governance_limits;
CREATE POLICY ai_usage_governance_admin_all
  ON public.ai_usage_governance_limits FOR ALL
  USING (public.app_current_role() IN ('super_admin', 'admin', 'operations_manager', 'auditor'))
  WITH CHECK (public.app_current_role() IN ('super_admin', 'admin', 'operations_manager'));

DROP POLICY IF EXISTS schema_migrations_admin_select ON public.schema_migrations;
CREATE POLICY schema_migrations_admin_select
  ON public.schema_migrations FOR SELECT
  USING (public.app_current_role() IN ('super_admin', 'admin', 'developer', 'auditor'));
