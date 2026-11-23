-- Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
-- Developer and claimed rights holder: Ophireum Multimedia Production
-- DTI-registered business, Philippines | Registration No. 7567003
-- SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
-- SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
-- Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.

-- ==============================================================================
-- OPHIREUM MULTIMEDIA PRODUCTION (OPHIREUM NETWORK)
-- MIGRATION 001: PHASE 1 CRITICAL SECURITY, RLS & DURABLE PERSISTENCE REPAIR
-- Safe for repeated idempotent execution on existing Supabase PostgreSQL instances
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Remove overly permissive legacy RLS policies immediately
DROP POLICY IF EXISTS "Public insert client profiles" ON public.client_profiles;
DROP POLICY IF EXISTS "Public insert conversation session" ON public.ai_conversation_sessions;
DROP POLICY IF EXISTS "Public access session by token" ON public.ai_conversation_sessions;
DROP POLICY IF EXISTS "Public update session by token" ON public.ai_conversation_sessions;
DROP POLICY IF EXISTS "Public insert requirements" ON public.project_requirements;
DROP POLICY IF EXISTS "Public insert project brief" ON public.project_briefs;
DROP POLICY IF EXISTS "Public insert appointment" ON public.consultation_appointments;
DROP POLICY IF EXISTS "Public read appointments" ON public.consultation_appointments;
DROP POLICY IF EXISTS "Public insert consent" ON public.consent_records;

-- 2. Admin RBAC table & helper
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'super_admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.is_ophireum_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.is_active = TRUE
        AND au.auth_user_id = auth.uid()
    );
$;

-- The helper is callable by authenticated users for RLS evaluation only.
-- It grants no row access by itself; each table's RLS policy remains authoritative.
REVOKE ALL ON FUNCTION public.is_ophireum_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_ophireum_admin() TO authenticated, service_role;

-- 3. Add durable solution_requests table
CREATE TABLE IF NOT EXISTS public.solution_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_code TEXT UNIQUE NOT NULL,
  idempotency_key TEXT UNIQUE,
  request_type TEXT NOT NULL DEFAULT 'solution_builder' CHECK (request_type IN ('contact_form', 'solution_builder')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  organization TEXT NOT NULL,
  industry TEXT,
  selected_services_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_options_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_one_time_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  estimated_monthly_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  preferred_currency TEXT NOT NULL DEFAULT 'USD' CHECK (preferred_currency IN ('USD', 'PHP')),
  php_conversion_rate NUMERIC(8, 2),
  estimated_budget_label TEXT,
  target_timeline TEXT,
  requirements_notes TEXT NOT NULL,
  attachment_filename TEXT,
  confidentiality_authorized BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'proposal_sent', 'archived')),
  email_delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_delivery_status IN ('pending', 'sent', 'failed', 'unconfigured')),
  source_channel TEXT NOT NULL DEFAULT 'website',
  client_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Upgrade consultation_appointments safely with server fields & unique active slot constraint
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE public.ai_conversation_sessions ADD COLUMN IF NOT EXISTS auth_user_id UUID;

ALTER TABLE public.consultation_appointments ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE public.consultation_appointments ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.consultation_appointments ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE public.consultation_appointments ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE public.consultation_appointments ADD COLUMN IF NOT EXISTS client_company TEXT;
ALTER TABLE public.consultation_appointments ADD COLUMN IF NOT EXISTS brief_reference_code TEXT;
ALTER TABLE public.consultation_appointments ADD COLUMN IF NOT EXISTS calendar_sync_status TEXT DEFAULT 'unconfigured';
ALTER TABLE public.consultation_appointments ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
ALTER TABLE public.consultation_appointments ADD COLUMN IF NOT EXISTS management_token_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_appointment_slot
  ON public.consultation_appointments (scheduled_date, scheduled_time_slot)
  WHERE status IN ('pending_review', 'confirmed');

-- 5. Upgrade notification_records into outbox-capable delivery ledger
ALTER TABLE public.notification_records ADD COLUMN IF NOT EXISTS dedupe_key TEXT UNIQUE;
ALTER TABLE public.notification_records ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.notification_records ADD COLUMN IF NOT EXISTS entity_reference TEXT;
ALTER TABLE public.notification_records ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.notification_records ADD COLUMN IF NOT EXISTS html_body TEXT;
ALTER TABLE public.notification_records ADD COLUMN IF NOT EXISTS text_body TEXT;
ALTER TABLE public.notification_records ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'resend';
ALTER TABLE public.notification_records ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE public.notification_records ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE public.notification_records ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE public.notification_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 6. Upgrade audit_logs
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS correlation_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS actor_role TEXT DEFAULT 'system';

-- 7. Enable RLS across all tables & apply strict admin/owner policies
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solution_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read admin_users" ON public.admin_users;
CREATE POLICY "Admin read admin_users" ON public.admin_users
  FOR SELECT USING (public.is_ophireum_admin());

DROP POLICY IF EXISTS "Admin full access solution_requests" ON public.solution_requests;
CREATE POLICY "Admin full access solution_requests" ON public.solution_requests
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "Owner or admin read client_profiles" ON public.client_profiles;
CREATE POLICY "Owner or admin read client_profiles" ON public.client_profiles
  FOR SELECT USING (auth.uid() = auth_user_id OR public.is_ophireum_admin());

DROP POLICY IF EXISTS "Owner or admin access ai_conversation_sessions" ON public.ai_conversation_sessions;
CREATE POLICY "Owner or admin access ai_conversation_sessions" ON public.ai_conversation_sessions
  FOR ALL USING ((auth.uid() IS NOT NULL AND auth.uid() = auth_user_id) OR public.is_ophireum_admin())
  WITH CHECK ((auth.uid() IS NOT NULL AND auth.uid() = auth_user_id) OR public.is_ophireum_admin());

DROP POLICY IF EXISTS "Admin read project_requirements" ON public.project_requirements;
CREATE POLICY "Admin read project_requirements" ON public.project_requirements
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "Admin read project_briefs" ON public.project_briefs;
CREATE POLICY "Admin read project_briefs" ON public.project_briefs
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "Admin access consultation_appointments" ON public.consultation_appointments;
CREATE POLICY "Admin access consultation_appointments" ON public.consultation_appointments
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "Admin access notification_records" ON public.notification_records;
CREATE POLICY "Admin access notification_records" ON public.notification_records
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

DROP POLICY IF EXISTS "Admin read consent_records" ON public.consent_records;
CREATE POLICY "Admin read consent_records" ON public.consent_records
  FOR SELECT USING (public.is_ophireum_admin());

DROP POLICY IF EXISTS "Admin read audit_logs" ON public.audit_logs;
CREATE POLICY "Admin read audit_logs" ON public.audit_logs
  FOR SELECT USING (public.is_ophireum_admin());

CREATE INDEX IF NOT EXISTS idx_sol_req_reference ON public.solution_requests (reference_code);
CREATE INDEX IF NOT EXISTS idx_sol_req_email ON public.solution_requests (email);
CREATE INDEX IF NOT EXISTS idx_sol_req_status_created ON public.solution_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appt_reference ON public.consultation_appointments (reference_code);
CREATE INDEX IF NOT EXISTS idx_notif_status_retry ON public.notification_records (status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs (created_at DESC);

COMMIT;
