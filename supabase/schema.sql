-- Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
-- Developer and claimed rights holder: Ophireum Multimedia Production
-- DTI-registered business, Philippines | Registration No. 7567003
-- SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
-- SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
-- Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.

-- ==============================================================================
-- OPHIREUM MULTIMEDIA PRODUCTION (OPHIREUM NETWORK)
-- HARDENED POSTGRESQL / SUPABASE DATABASE SCHEMA (PHASE 1 STABILIZATION)
-- ==============================================================================

-- 1. Enable UUID & Crypto Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Trusted Administrator RBAC Allowlist Table
-- Authoritative role source enforced on both PostgreSQL RLS and Node API
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

-- Helper SQL function checking authenticated JWT email / uid against active admin_users
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
      AND (
        au.auth_user_id = auth.uid()
        OR LOWER(au.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      )
  );
$$;

-- 3. Client Profiles Table
CREATE TABLE IF NOT EXISTS public.client_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  industry TEXT,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Solution Requests & Preliminary Project Inquiries (Durable Backend Persistence)
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

-- 5. AI Conversation Sessions Table
CREATE TABLE IF NOT EXISTS public.ai_conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token TEXT UNIQUE NOT NULL,
  auth_user_id UUID,
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  stage TEXT DEFAULT 'welcome',
  messages JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Project Requirements & Discovery Table
CREATE TABLE IF NOT EXISTS public.project_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.ai_conversation_sessions(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  project_category TEXT NOT NULL,
  business_problem TEXT,
  target_users TEXT,
  key_features JSONB DEFAULT '[]'::jsonb,
  existing_systems TEXT,
  third_party_integrations JSONB DEFAULT '[]'::jsonb,
  scale_estimate TEXT,
  budget_preference TEXT,
  target_timeline TEXT,
  special_requirements TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. AI Generated Project Briefs Table
CREATE TABLE IF NOT EXISTS public.project_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_code TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  requirements_id UUID REFERENCES public.project_requirements(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  technical_architecture JSONB NOT NULL,
  commercial_discovery JSONB NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Consultation Appointments Table (Server-Enforced Availability & Calendar Sync)
CREATE TABLE IF NOT EXISTS public.consultation_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_code TEXT UNIQUE NOT NULL,
  idempotency_key TEXT UNIQUE,
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  brief_id UUID REFERENCES public.project_briefs(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_company TEXT,
  brief_reference_code TEXT,
  consultation_type TEXT NOT NULL CHECK (consultation_type IN ('video', 'phone', 'in_person')),
  scheduled_date DATE NOT NULL,
  scheduled_time_slot TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  client_timezone TEXT NOT NULL DEFAULT 'Asia/Manila',
  meeting_link TEXT,
  meeting_location TEXT,
  assigned_consultant TEXT NOT NULL DEFAULT 'Dhenze Languisan (Founder & CEO)',
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'confirmed', 'rescheduled', 'cancelled', 'completed')),
  calendar_sync_status TEXT NOT NULL DEFAULT 'unconfigured' CHECK (calendar_sync_status IN ('synced', 'pending', 'failed', 'unconfigured')),
  calendar_event_id TEXT,
  management_token_hash TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent double-booking active time slots at the database level
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_appointment_slot
  ON public.consultation_appointments (scheduled_date, scheduled_time_slot)
  WHERE status IN ('pending_review', 'confirmed');

-- 9. Durable Transactional Email Outbox & Delivery Records
CREATE TABLE IF NOT EXISTS public.notification_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dedupe_key TEXT UNIQUE NOT NULL,
  entity_type TEXT NOT NULL, -- 'solution_request' | 'appointment'
  entity_reference TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  notification_type TEXT NOT NULL, -- 'customer_confirmation' | 'admin_alert' | 'appointment_request' | 'appointment_update'
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'unconfigured')),
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_reference TEXT,
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Client Consent & Privacy Records Table
CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Enterprise Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  correlation_id TEXT,
  actor TEXT NOT NULL,
  actor_role TEXT DEFAULT 'system',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- Zero public SELECT/UPDATE/DELETE of customer PII, inquiries, sessions, or appointments.
-- Public writes go exclusively through validated Express API endpoints using service_role.
-- ==============================================================================

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solution_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies across operational tables
DROP POLICY IF EXISTS "Admin read admin_users" ON public.admin_users;
CREATE POLICY "Admin read admin_users" ON public.admin_users
  FOR SELECT USING (public.is_ophireum_admin());

DROP POLICY IF EXISTS "Owner or admin read client_profiles" ON public.client_profiles;
CREATE POLICY "Owner or admin read client_profiles" ON public.client_profiles
  FOR SELECT USING (auth.uid() = auth_user_id OR public.is_ophireum_admin());

DROP POLICY IF EXISTS "Admin full access solution_requests" ON public.solution_requests;
CREATE POLICY "Admin full access solution_requests" ON public.solution_requests
  FOR ALL USING (public.is_ophireum_admin()) WITH CHECK (public.is_ophireum_admin());

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

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sol_req_reference ON public.solution_requests (reference_code);
CREATE INDEX IF NOT EXISTS idx_sol_req_email ON public.solution_requests (email);
CREATE INDEX IF NOT EXISTS idx_sol_req_status_created ON public.solution_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appt_date_slot ON public.consultation_appointments (scheduled_date, scheduled_time_slot, status);
CREATE INDEX IF NOT EXISTS idx_appt_reference ON public.consultation_appointments (reference_code);
CREATE INDEX IF NOT EXISTS idx_notif_status_retry ON public.notification_records (status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs (created_at DESC);
