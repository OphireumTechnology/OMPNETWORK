-- ==============================================================================
-- OPHIREUM MULTIMEDIA PRODUCTION (OPHIREUM NETWORK)
-- MIGRATION 000: IDEMPOTENT BASELINE CORE SCHEMA (CLEAN-ROOM BOOTSTRAP)
-- Safe to run on both brand-new PostgreSQL/Supabase databases and existing ones.
-- Ensures migrations 000 -> 001 -> 002 -> 003 apply deterministically in order.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Client Profiles
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

-- 2. AI Conversation Sessions
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

-- 3. Project Requirements & Discovery
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

-- 4. AI Generated Project Briefs
CREATE TABLE IF NOT EXISTS public.project_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_code TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  requirements_id UUID REFERENCES public.project_requirements(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  technical_architecture JSONB NOT NULL DEFAULT '{}'::jsonb,
  commercial_discovery JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Consultation Appointments
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

-- 6. Notification / Transactional Email Outbox Records
CREATE TABLE IF NOT EXISTS public.notification_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dedupe_key TEXT UNIQUE NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'solution_request',
  entity_reference TEXT NOT NULL DEFAULT '',
  recipient_email TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  html_body TEXT NOT NULL DEFAULT '',
  text_body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
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

-- 7. Consent Records
CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Audit Logs
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
