-- ==============================================================================
-- OPHIREUM MULTIMEDIA PRODUCTION (OPHIREUM NETWORK)
-- MIGRATION 003: ENTERPRISE PLATFORM EXPANSION (PHASES 2-17)
-- Covers:
--   - UUID-first hardened RBAC (9 roles, granular permissions, session revocation)
--   - Immutable append-only audit_logs protection trigger
--   - Atomic Asia/Manila payment reference generator (MMDDYYYYHHMMAM/PMNNN)
--   - Organizations, Promotions, Order Status History, Payment Refunds
--   - Digital Entitlements & Download Logs, Project Tasks
--   - Enterprise AI Workforce (25 Agents A00-A24), Executions, Escalations, Usage
--   - Central AI Knowledge System (Documents & Chunks with tenant isolation)
--   - Durable Background Jobs Queue (FOR UPDATE SKIP LOCKED), Integration Health
--   - System Configurations, Legal Policy Versions, Privacy / Data Subject Requests
--   - Strict Private Storage Buckets & Row Level Security across all new tables
-- ==============================================================================

-- 1. Expand admin_users roles & enforce UUID-first is_ophireum_admin()
ALTER TABLE public.admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;
ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_role_check CHECK (
    role IN (
      'super_admin',
      'admin',
      'operations_manager',
      'finance_officer',
      'sales_officer',
      'project_manager',
      'developer',
      'support_officer',
      'auditor'
    )
  );

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.is_ophireum_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.is_active = TRUE
      AND auth.uid() IS NOT NULL
      AND au.auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_ophireum_admin_role(allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.is_active = TRUE
      AND auth.uid() IS NOT NULL
      AND au.auth_user_id = auth.uid()
      AND au.role = ANY(allowed_roles)
  );
$$;

-- 2. Immutable Audit Log Protection (Prevent UPDATE / DELETE on public.audit_logs)
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only and cannot be modified or deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- 3. Expand notification_records delivery states for webhook lifecycle tracking
ALTER TABLE public.notification_records DROP CONSTRAINT IF EXISTS notification_records_status_check;
ALTER TABLE public.notification_records
  ADD CONSTRAINT notification_records_status_check CHECK (
    status IN (
      'queued',
      'provider_accepted',
      'sent',
      'delivered',
      'bounced',
      'failed',
      'retrying',
      'unconfigured'
    )
  );

-- 4. Atomic Payment Reference Sequence (Asia/Manila MMDDYYYYHHMMAM/PMNNN)
CREATE TABLE IF NOT EXISTS public.payment_reference_sequences (
  minute_bucket TEXT PRIMARY KEY, -- e.g. '032520260215PM'
  last_seq INTEGER NOT NULL DEFAULT 0 CHECK (last_seq >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.allocate_ophireum_payment_ref(p_ts TIMESTAMPTZ DEFAULT NOW())
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manila TIMESTAMP;
  v_bucket TEXT;
  v_seq INTEGER;
  v_suffix TEXT;
BEGIN
  v_manila := p_ts AT TIME ZONE 'Asia/Manila';
  v_bucket := TO_CHAR(v_manila, 'MMDDYYYYHH12MIAM');

  INSERT INTO public.payment_reference_sequences (minute_bucket, last_seq, updated_at)
  VALUES (v_bucket, 1, NOW())
  ON CONFLICT (minute_bucket)
  DO UPDATE SET
    last_seq = public.payment_reference_sequences.last_seq + 1,
    updated_at = NOW()
  RETURNING last_seq INTO v_seq;

  IF v_seq <= 999 THEN
    v_suffix := LPAD(v_seq::TEXT, 3, '0');
  ELSE
    -- Explicit overflow protection beyond 999 payments in a single minute
    v_suffix := LPAD(v_seq::TEXT, 4, '0');
  END IF;

  RETURN v_bucket || v_suffix;
END;
$$;

-- 5. RBAC Roles, Permissions, Admin Sessions & Security Events
CREATE TABLE IF NOT EXISTS public.roles (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_code TEXT NOT NULL REFERENCES public.roles(code) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  jti TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  event_type TEXT NOT NULL,
  actor TEXT,
  ip_address TEXT,
  correlation_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Customer Organizations & Team Memberships
CREATE TABLE IF NOT EXISTS public.customer_organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  tax_id TEXT,
  industry TEXT,
  billing_email TEXT,
  billing_address TEXT,
  country TEXT NOT NULL DEFAULT 'Philippines',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.customer_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  member_email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'billing_admin', 'project_manager', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, member_email)
);

-- 7. Promotions, Redemptions, Order Status History & Payment Refunds
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed_usd_minor')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  min_subtotal_usd_minor INTEGER NOT NULL DEFAULT 0 CHECK (min_subtotal_usd_minor >= 0),
  max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redemption_count INTEGER NOT NULL DEFAULT 0 CHECK (redemption_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promotion_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_applied_minor INTEGER NOT NULL CHECK (discount_applied_minor >= 0),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'PHP')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'processed', 'rejected', 'failed')),
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  provider_refund_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Digital Fulfillment Entitlements & Download Logs + Project Tasks
CREATE TABLE IF NOT EXISTS public.digital_entitlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  package_name TEXT NOT NULL,
  license_key TEXT UNIQUE NOT NULL,
  storage_path TEXT NOT NULL,
  version_label TEXT NOT NULL DEFAULT '1.0.0',
  max_downloads INTEGER NOT NULL DEFAULT 10 CHECK (max_downloads > 0),
  download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.digital_download_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entitlement_id UUID NOT NULL REFERENCES public.digital_entitlements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assignee_email TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'blocked')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Enterprise AI Workforce (A00-A24), Executions, Knowledge System & Escalations
CREATE TABLE IF NOT EXISTS public.ai_agents (
  code TEXT PRIMARY KEY, -- A00 .. A24
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  description TEXT NOT NULL,
  model_name TEXT NOT NULL DEFAULT 'gemini-4-hydrogen',
  system_instruction TEXT NOT NULL,
  allowed_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_roles JSONB NOT NULL DEFAULT '["super_admin","admin"]'::jsonb,
  requires_human_approval BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_agent_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_code TEXT NOT NULL REFERENCES public.ai_agents(code) ON DELETE RESTRICT,
  correlation_id TEXT,
  actor TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  tenant_user_id UUID,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_payload JSONB,
  tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'running', 'completed', 'failed', 'escalated')),
  approval_required BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  provider_model TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_knowledge_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal_admin', 'tenant_private')),
  tenant_user_id UUID,
  version INTEGER NOT NULL DEFAULT 1,
  approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('draft', 'pending_review', 'approved', 'archived')),
  source_uri TEXT,
  raw_content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.ai_knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  embedding_json JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS public.ai_usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_code TEXT,
  endpoint TEXT NOT NULL,
  model_name TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_human_escalations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL, -- 'consultant_chat' | 'voice' | 'agent_execution'
  session_id TEXT,
  user_email TEXT,
  reason TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'resolved')),
  assigned_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Durable Background Jobs Queue (FOR UPDATE SKIP LOCKED), Integration Health & Config
CREATE TABLE IF NOT EXISTS public.background_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type TEXT NOT NULL,
  dedupe_key TEXT UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.claim_next_background_job(p_worker_id TEXT)
RETURNS SETOF public.background_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH next_job AS (
    SELECT id
    FROM public.background_jobs
    WHERE status IN ('queued', 'failed')
      AND attempts < max_attempts
      AND run_after <= NOW()
    ORDER BY run_after ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.background_jobs bj
  SET
    status = 'processing',
    attempts = bj.attempts + 1,
    locked_at = NOW(),
    locked_by = p_worker_id,
    updated_at = NOW()
  FROM next_job
  WHERE bj.id = next_job.id
  RETURNING bj.*;
END;
$$;

CREATE TABLE IF NOT EXISTS public.integration_health_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  integration_key TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'disabled',
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'unconfigured', 'error')),
  latency_ms INTEGER,
  message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_configurations (
  key TEXT PRIMARY KEY,
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Legal Policy Versions & Privacy / Data Subject Requests (PH RA 10173 / GDPR)
CREATE TABLE IF NOT EXISTS public.legal_policy_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_slug TEXT NOT NULL,
  version_tag TEXT NOT NULL,
  title TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending_legal_review' CHECK (review_status IN ('draft', 'pending_legal_review', 'approved', 'superseded')),
  effective_date DATE,
  content_markdown TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (policy_slug, version_tag)
);

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_code TEXT UNIQUE NOT NULL,
  user_id UUID,
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('data_access', 'data_export', 'rectification', 'erasure', 'objection', 'complaint')),
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'verifying_identity', 'in_progress', 'completed', 'rejected')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Strict Row Level Security (RLS) on All New Tables
ALTER TABLE public.payment_reference_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_download_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_human_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

-- Admin-only governance policies
DROP POLICY IF EXISTS "admin_only_payment_ref_seq" ON public.payment_reference_sequences;
CREATE POLICY "admin_only_payment_ref_seq" ON public.payment_reference_sequences
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_roles" ON public.roles;
CREATE POLICY "admin_only_roles" ON public.roles
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_permissions" ON public.permissions;
CREATE POLICY "admin_only_permissions" ON public.permissions
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_role_permissions" ON public.role_permissions;
CREATE POLICY "admin_only_role_permissions" ON public.role_permissions
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_admin_sessions" ON public.admin_sessions;
CREATE POLICY "admin_only_admin_sessions" ON public.admin_sessions
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_security_events" ON public.security_events;
CREATE POLICY "admin_only_security_events" ON public.security_events
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "owner_or_admin_customer_orgs" ON public.customer_organizations;
CREATE POLICY "owner_or_admin_customer_orgs" ON public.customer_organizations
  FOR ALL USING (auth.uid() = owner_user_id OR public.is_ophireum_admin())
  WITH CHECK (auth.uid() = owner_user_id OR public.is_ophireum_admin());

DROP POLICY IF EXISTS "member_or_admin_org_members" ON public.organization_members;
CREATE POLICY "member_or_admin_org_members" ON public.organization_members
  FOR SELECT USING (auth.uid() = user_id OR public.is_ophireum_admin());

DROP POLICY IF EXISTS "public_read_active_promotions" ON public.promotions;
CREATE POLICY "public_read_active_promotions" ON public.promotions
  FOR SELECT USING (is_active = TRUE OR public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_manage_promotions" ON public.promotions;
CREATE POLICY "admin_manage_promotions" ON public.promotions
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "owner_or_admin_promo_redemptions" ON public.promotion_redemptions;
CREATE POLICY "owner_or_admin_promo_redemptions" ON public.promotion_redemptions
  FOR SELECT USING (auth.uid() = user_id OR public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_order_status_history" ON public.order_status_history;
CREATE POLICY "admin_only_order_status_history" ON public.order_status_history
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_payment_refunds" ON public.payment_refunds;
CREATE POLICY "admin_only_payment_refunds" ON public.payment_refunds
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "owner_or_admin_digital_entitlements" ON public.digital_entitlements;
CREATE POLICY "owner_or_admin_digital_entitlements" ON public.digital_entitlements
  FOR SELECT USING (auth.uid() = user_id OR public.is_ophireum_admin());

DROP POLICY IF EXISTS "owner_or_admin_digital_download_logs" ON public.digital_download_logs;
CREATE POLICY "owner_or_admin_digital_download_logs" ON public.digital_download_logs
  FOR SELECT USING (auth.uid() = user_id OR public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_project_tasks" ON public.project_tasks;
CREATE POLICY "admin_only_project_tasks" ON public.project_tasks
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_ai_agents" ON public.ai_agents;
CREATE POLICY "admin_only_ai_agents" ON public.ai_agents
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_ai_agent_executions" ON public.ai_agent_executions;
CREATE POLICY "admin_only_ai_agent_executions" ON public.ai_agent_executions
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "tenant_or_public_ai_knowledge_docs" ON public.ai_knowledge_documents;
CREATE POLICY "tenant_or_public_ai_knowledge_docs" ON public.ai_knowledge_documents
  FOR SELECT USING (
    (visibility = 'public' AND approval_status = 'approved')
    OR (visibility = 'tenant_private' AND auth.uid() = tenant_user_id)
    OR public.is_ophireum_admin()
  );

DROP POLICY IF EXISTS "admin_manage_ai_knowledge_docs" ON public.ai_knowledge_documents;
CREATE POLICY "admin_manage_ai_knowledge_docs" ON public.ai_knowledge_documents
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_ai_knowledge_chunks" ON public.ai_knowledge_chunks;
CREATE POLICY "admin_only_ai_knowledge_chunks" ON public.ai_knowledge_chunks
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_ai_usage_records" ON public.ai_usage_records;
CREATE POLICY "admin_only_ai_usage_records" ON public.ai_usage_records
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_ai_human_escalations" ON public.ai_human_escalations;
CREATE POLICY "admin_only_ai_human_escalations" ON public.ai_human_escalations
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_background_jobs" ON public.background_jobs;
CREATE POLICY "admin_only_background_jobs" ON public.background_jobs
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_integration_health" ON public.integration_health_records;
CREATE POLICY "admin_only_integration_health" ON public.integration_health_records
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "admin_only_system_configurations" ON public.system_configurations;
CREATE POLICY "admin_only_system_configurations" ON public.system_configurations
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "public_read_legal_policies" ON public.legal_policy_versions;
CREATE POLICY "public_read_legal_policies" ON public.legal_policy_versions
  FOR SELECT USING (review_status IN ('pending_legal_review', 'approved') OR public.is_ophireum_admin());

DROP POLICY IF EXISTS "owner_or_admin_privacy_requests" ON public.privacy_requests;
CREATE POLICY "owner_or_admin_privacy_requests" ON public.privacy_requests
  FOR SELECT USING ((auth.uid() IS NOT NULL AND auth.uid() = user_id) OR public.is_ophireum_admin());

-- 13. Private Storage Buckets Setup (guarded for environments with Supabase storage schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES
      ('customer-uploads', 'customer-uploads', FALSE),
      ('digital-products', 'digital-products', FALSE),
      ('project-deliverables', 'project-deliverables', FALSE),
      ('invoices-pdf', 'invoices-pdf', FALSE),
      ('receipts-pdf', 'receipts-pdf', FALSE),
      ('business-documents', 'business-documents', FALSE)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 14. Operational Indexes
CREATE INDEX IF NOT EXISTS idx_admin_sessions_jti ON public.admin_sessions (jti);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digital_entitlements_user ON public.digital_entitlements (user_id, status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON public.project_tasks (project_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_exec_agent_created ON public.ai_agent_executions (agent_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_vis_status ON public.ai_knowledge_documents (visibility, approval_status, tenant_user_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_claim ON public.background_jobs (status, run_after);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_email ON public.privacy_requests (requester_email, created_at DESC);
