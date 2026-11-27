-- ==============================================================================
-- OPHIREUM MULTIMEDIA PRODUCTION (OPHIREUM NETWORK)
-- MIGRATION 004: FINAL RECONCILIATION SECURITY, RLS, DISTRIBUTED STATE & STORAGE
-- Safe for idempotent execution after 000 -> 001 -> 002 -> 003.
-- DO NOT APPLY TO PRODUCTION WITHOUT BACKUP, STAGING VERIFICATION & OWNER APPROVAL.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. HARDEN ALL SECURITY DEFINER & TRIGGER FUNCTIONS (search_path + REVOKE PUBLIC)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_ophireum_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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
SET search_path = public, pg_temp
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

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only and cannot be modified or deleted';
END;
$$;

CREATE OR REPLACE FUNCTION public.allocate_ophireum_payment_ref(p_ts TIMESTAMPTZ DEFAULT NOW())
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

  IF v_seq > 999 THEN
    RAISE EXCEPTION 'PAYMENT_REF_MINUTE_SEQUENCE_EXHAUSTED: minute bucket % exceeded 999 allocations', v_bucket
      USING ERRCODE = 'P0001';
  END IF;
  v_suffix := LPAD(v_seq::TEXT, 3, '0');

  RETURN v_bucket || v_suffix;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_next_background_job(p_worker_id TEXT)
RETURNS SETOF public.background_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Enforce least-privilege EXECUTE grants on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.is_ophireum_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_ophireum_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_ophireum_admin_role(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_ophireum_admin_role(TEXT[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.allocate_ophireum_payment_ref(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_ophireum_payment_ref(TIMESTAMPTZ) TO service_role;

REVOKE ALL ON FUNCTION public.claim_next_background_job(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_background_job(TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 2. DISTRIBUTED SECURITY TABLES (REVOKED TOKENS, RATE LIMITER, ENCRYPTED MFA)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.revoked_session_tokens (
  jti TEXT PRIMARY KEY,
  principal_type TEXT NOT NULL CHECK (principal_type IN ('admin', 'client')),
  principal_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires
  ON public.revoked_session_tokens (expires_at);

CREATE TABLE IF NOT EXISTS public.distributed_rate_limit_buckets (
  bucket_key TEXT NOT NULL,
  window_start_ms BIGINT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 1 CHECK (hit_count >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (bucket_key, window_start_ms)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_expires
  ON public.distributed_rate_limit_buckets (expires_at);

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_bucket_key TEXT,
  p_window_ms BIGINT,
  p_max_hits INTEGER
)
RETURNS TABLE(allowed BOOLEAN, current_hits INTEGER, remaining INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now_ms BIGINT;
  v_window_start BIGINT;
  v_hits INTEGER;
BEGIN
  v_now_ms := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
  v_window_start := (v_now_ms / GREATEST(p_window_ms, 1000)) * GREATEST(p_window_ms, 1000);

  DELETE FROM public.distributed_rate_limit_buckets
  WHERE expires_at < NOW()
    AND bucket_key = p_bucket_key;

  INSERT INTO public.distributed_rate_limit_buckets (bucket_key, window_start_ms, hit_count, expires_at)
  VALUES (
    p_bucket_key,
    v_window_start,
    1,
    TO_TIMESTAMP((v_window_start + GREATEST(p_window_ms, 1000)) / 1000.0)
  )
  ON CONFLICT (bucket_key, window_start_ms)
  DO UPDATE SET
    hit_count = public.distributed_rate_limit_buckets.hit_count + 1
  RETURNING hit_count INTO v_hits;

  allowed := v_hits <= p_max_hits;
  current_hits := v_hits;
  remaining := GREATEST(0, p_max_hits - v_hits);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(TEXT, BIGINT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(TEXT, BIGINT, INTEGER) TO service_role;

CREATE TABLE IF NOT EXISTS public.mfa_credentials (
  principal_type TEXT NOT NULL CHECK (principal_type IN ('admin', 'client')),
  principal_id TEXT NOT NULL,
  encrypted_secret TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_step BIGINT,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (principal_type, principal_id)
);

CREATE TABLE IF NOT EXISTS public.mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_type TEXT NOT NULL CHECK (principal_type IN ('admin', 'client')),
  principal_id TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (principal_type, principal_id, code_hash)
);

-- ------------------------------------------------------------------------------
-- 3. LIFECYCLE EXTENSIONS (AI APPROVAL BINDING, ORDER EXPIRATION, SUBSCRIPTIONS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.ai_agent_executions
  ADD COLUMN IF NOT EXISTS action_hash TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0;

ALTER TABLE public.ai_agent_executions DROP CONSTRAINT IF EXISTS ai_agent_executions_status_check;
ALTER TABLE public.ai_agent_executions
  ADD CONSTRAINT ai_agent_executions_status_check CHECK (
    status IN (
      'pending_approval',
      'approved',
      'rejected',
      'cancelled',
      'expired',
      'running',
      'completed',
      'failed',
      'escalated'
    )
  );

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_renewal_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check CHECK (
    account_status IN ('active', 'suspended', 'pending_closure', 'closed')
  );

-- ------------------------------------------------------------------------------
-- 4. LEAST-PRIVILEGE GRANTS & RLS LOCKDOWN ACROSS ALL PHASE 001 / 003 / 004 TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.revoked_session_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributed_rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'admin_users', 'solution_requests', 'client_profiles', 'ai_conversation_sessions',
    'project_requirements', 'project_briefs', 'consultation_appointments',
    'notification_records', 'consent_records', 'audit_logs',
    'payment_reference_sequences', 'roles', 'permissions', 'role_permissions',
    'admin_sessions', 'security_events', 'customer_organizations', 'organization_members',
    'promotions', 'promotion_redemptions', 'order_status_history', 'payment_refunds',
    'digital_entitlements', 'digital_download_logs', 'project_tasks', 'ai_agents',
    'ai_agent_executions', 'ai_knowledge_documents', 'ai_knowledge_chunks',
    'ai_usage_records', 'ai_human_escalations', 'background_jobs',
    'integration_health_records', 'system_configurations', 'legal_policy_versions',
    'privacy_requests', 'revoked_session_tokens', 'distributed_rate_limit_buckets',
    'mfa_credentials', 'mfa_recovery_codes'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated;', tbl);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role;', tbl);
  END LOOP;
END $$;

-- Grant minimum SELECT required by RLS policies to authenticated / anon roles
GRANT SELECT ON TABLE public.client_profiles TO authenticated;
GRANT SELECT ON TABLE public.ai_conversation_sessions TO authenticated;
GRANT SELECT ON TABLE public.customer_organizations TO authenticated;
GRANT SELECT ON TABLE public.organization_members TO authenticated;
GRANT SELECT ON TABLE public.promotions TO anon, authenticated;
GRANT SELECT ON TABLE public.promotion_redemptions TO authenticated;
GRANT SELECT ON TABLE public.digital_entitlements TO authenticated;
GRANT SELECT ON TABLE public.digital_download_logs TO authenticated;
GRANT SELECT ON TABLE public.ai_knowledge_documents TO anon, authenticated;
GRANT SELECT ON TABLE public.legal_policy_versions TO anon, authenticated;
GRANT SELECT ON TABLE public.privacy_requests TO authenticated;

-- Admin role read access via authenticated Supabase JWTs (strictly gated by is_ophireum_admin() RLS)
GRANT SELECT ON TABLE public.admin_users TO authenticated;
GRANT SELECT ON TABLE public.solution_requests TO authenticated;
GRANT SELECT ON TABLE public.consultation_appointments TO authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

-- Explicit server-only RLS deny policies on new security tables
DROP POLICY IF EXISTS "service_only_revoked_tokens" ON public.revoked_session_tokens;
CREATE POLICY "service_only_revoked_tokens" ON public.revoked_session_tokens
  FOR ALL USING (public.has_ophireum_admin_role(ARRAY['super_admin']))
  WITH CHECK (public.has_ophireum_admin_role(ARRAY['super_admin']));

DROP POLICY IF EXISTS "service_only_rate_limits" ON public.distributed_rate_limit_buckets;
CREATE POLICY "service_only_rate_limits" ON public.distributed_rate_limit_buckets
  FOR ALL USING (public.has_ophireum_admin_role(ARRAY['super_admin']))
  WITH CHECK (public.has_ophireum_admin_role(ARRAY['super_admin']));

DROP POLICY IF EXISTS "service_only_mfa_credentials" ON public.mfa_credentials;
CREATE POLICY "service_only_mfa_credentials" ON public.mfa_credentials
  FOR ALL USING (public.has_ophireum_admin_role(ARRAY['super_admin']))
  WITH CHECK (public.has_ophireum_admin_role(ARRAY['super_admin']));

DROP POLICY IF EXISTS "service_only_mfa_recovery_codes" ON public.mfa_recovery_codes;
CREATE POLICY "service_only_mfa_recovery_codes" ON public.mfa_recovery_codes
  FOR ALL USING (public.has_ophireum_admin_role(ARRAY['super_admin']))
  WITH CHECK (public.has_ophireum_admin_role(ARRAY['super_admin']));

-- ------------------------------------------------------------------------------
-- 5. SIX PRIVATE STORAGE BUCKETS HARDENING & EXPLICIT STORAGE.OBJECTS RLS POLICIES
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    UPDATE storage.buckets
    SET
      public = FALSE,
      file_size_limit = 26214400
    WHERE id IN (
      'customer-uploads',
      'digital-products',
      'project-deliverables',
      'invoices-pdf',
      'receipts-pdf',
      'business-documents'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "owner_or_admin_read_customer_uploads" ON storage.objects;
    CREATE POLICY "owner_or_admin_read_customer_uploads"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'customer-uploads'
        AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_ophireum_admin())
      );

    DROP POLICY IF EXISTS "owner_or_admin_read_project_deliverables" ON storage.objects;
    CREATE POLICY "owner_or_admin_read_project_deliverables"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'project-deliverables'
        AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_ophireum_admin())
      );

    DROP POLICY IF EXISTS "owner_or_admin_read_invoices_pdf" ON storage.objects;
    CREATE POLICY "owner_or_admin_read_invoices_pdf"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'invoices-pdf'
        AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_ophireum_admin())
      );

    DROP POLICY IF EXISTS "owner_or_admin_read_receipts_pdf" ON storage.objects;
    CREATE POLICY "owner_or_admin_read_receipts_pdf"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'receipts-pdf'
        AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_ophireum_admin())
      );

    DROP POLICY IF EXISTS "entitled_or_admin_read_digital_products" ON storage.objects;
    CREATE POLICY "entitled_or_admin_read_digital_products"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'digital-products'
        AND (
          public.is_ophireum_admin()
          OR EXISTS (
            SELECT 1
            FROM public.digital_entitlements de
            WHERE de.user_id = auth.uid()
              AND de.status = 'active'
              AND de.storage_path = name
              AND de.download_count < de.max_downloads
              AND (de.expires_at IS NULL OR de.expires_at > NOW())
          )
        )
      );

    DROP POLICY IF EXISTS "admin_only_business_documents" ON storage.objects;
    CREATE POLICY "admin_only_business_documents"
      ON storage.objects FOR ALL TO authenticated
      USING (bucket_id = 'business-documents' AND public.is_ophireum_admin())
      WITH CHECK (bucket_id = 'business-documents' AND public.is_ophireum_admin());
  END IF;
END $$;

COMMIT;
