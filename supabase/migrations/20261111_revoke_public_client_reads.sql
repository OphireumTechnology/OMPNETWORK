-- Apply only to the dedicated OMPNETWORK Supabase project after backup and policy review.
-- Existing policies persist when schema.sql is edited; explicitly drop legacy public policies.
DROP POLICY IF EXISTS "Public access session by token" ON public.ai_conversation_sessions;
DROP POLICY IF EXISTS "Public update session by token" ON public.ai_conversation_sessions;
DROP POLICY IF EXISTS "Public read appointments" ON public.consultation_appointments;

-- No anonymous client may query sensitive conversation or appointment records.
REVOKE SELECT, UPDATE ON TABLE public.ai_conversation_sessions FROM anon;
REVOKE SELECT ON TABLE public.consultation_appointments FROM anon;
