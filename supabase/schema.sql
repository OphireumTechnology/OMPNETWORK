-- ==============================================================================
-- OPHIREUM MULTIMEDIA PRODUCTION (OPHIREUM NETWORK)
-- DEDICATED SUPABASE DATABASE SCHEMA
-- Separate from TaxGuard and other business systems
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Client Profiles Table
CREATE TABLE IF NOT EXISTS public.client_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  industry TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AI Conversation Sessions Table
CREATE TABLE IF NOT EXISTS public.ai_conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  stage TEXT DEFAULT 'welcome',
  messages JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Project Requirements & Discovery Table
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. AI Generated Project Briefs Table
CREATE TABLE IF NOT EXISTS public.project_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_code TEXT UNIQUE NOT NULL, -- e.g. OPM-BRF-2026-XXXX
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  requirements_id UUID REFERENCES public.project_requirements(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  technical_architecture JSONB NOT NULL,
  commercial_discovery JSONB NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, reviewed_by_client, confirmed, archived
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Consultation Appointments Table
CREATE TABLE IF NOT EXISTS public.consultation_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_code TEXT UNIQUE NOT NULL, -- e.g. OPM-APT-2026-XXXX
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  brief_id UUID REFERENCES public.project_briefs(id) ON DELETE SET NULL,
  consultation_type TEXT NOT NULL, -- 'video', 'phone', 'in_person'
  scheduled_date DATE NOT NULL,
  scheduled_time_slot TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  client_timezone TEXT DEFAULT 'Asia/Manila',
  meeting_link TEXT,
  meeting_location TEXT,
  assigned_consultant TEXT DEFAULT 'Dhenze Languisan (Founder & CEO)',
  status TEXT DEFAULT 'confirmed', -- confirmed, rescheduled, cancelled, completed
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Notification Delivery Records Table
CREATE TABLE IF NOT EXISTS public.notification_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email TEXT NOT NULL,
  notification_type TEXT NOT NULL, -- 'appointment_confirmation', 'internal_consultant_alert', 'brief_receipt'
  status TEXT DEFAULT 'queued', -- queued, sent, delivered, failed
  provider_reference TEXT,
  delivery_attempts INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Client Consent & Privacy Records Table
CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.client_profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL, -- 'data_privacy', 'nda_acknowledgement'
  ip_address TEXT,
  user_agent TEXT,
  granted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Enterprise Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Isolation: Public users cannot read other clients' private data
-- ==============================================================================

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Anonymous inserts are permitted only where required; no public session or appointment reads.
-- For existing deployments, run the companion policy-revocation migration.
CREATE POLICY "Public insert client profiles" ON public.client_profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public insert conversation session" ON public.ai_conversation_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public insert requirements" ON public.project_requirements
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public insert project brief" ON public.project_briefs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public insert appointment" ON public.consultation_appointments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public insert consent" ON public.consent_records
  FOR INSERT WITH CHECK (true);

-- Indexes for lightning fast lookups & double-booking prevention
CREATE INDEX IF NOT EXISTS idx_appt_date_slot ON public.consultation_appointments (scheduled_date, scheduled_time_slot, status);
CREATE INDEX IF NOT EXISTS idx_session_token ON public.ai_conversation_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_brief_reference ON public.project_briefs (reference_code);
