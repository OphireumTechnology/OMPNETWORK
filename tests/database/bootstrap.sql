-- Disposable PostgreSQL fixture approximating Supabase-managed schemas.
-- This is CI-only test scaffolding. It is never applied to hosted Supabase.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  email_confirmed_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID
$$;
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS JSONB LANGUAGE SQL STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::JSONB
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN NOT NULL DEFAULT FALSE,
  file_size_limit BIGINT,
  allowed_mime_types TEXT[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT,
  name TEXT
);
CREATE OR REPLACE FUNCTION storage.foldername(name TEXT)
RETURNS TEXT[] LANGUAGE SQL IMMUTABLE AS $$
  SELECT string_to_array(name, '/')[1:array_length(string_to_array(name, '/'), 1)-1]
$$;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

-- Minimal legacy schema expected by migration 001. Production baseline objects
-- are deliberately represented as empty tables for deterministic migration tests.
CREATE TABLE public.client_profiles (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.ai_conversation_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.project_requirements (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.project_briefs (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.consultation_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_date DATE,
  scheduled_time_slot TEXT,
  status TEXT,
  reference_code TEXT
);
CREATE TABLE public.notification_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), status TEXT);
CREATE TABLE public.consent_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE public.audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), created_at TIMESTAMPTZ DEFAULT NOW());
