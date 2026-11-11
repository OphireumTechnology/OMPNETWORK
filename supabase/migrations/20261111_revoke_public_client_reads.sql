-- Apply to the dedicated OMPNETWORK Supabase database after review.
-- Existing policies persist when schema.sql is edited; explicitly drop them.
DROP POLICY IF EXISTS "Public access session by token" ON public.ai_conversation_sessions;
DROP POLICY IF EXISTS "Public update session by token" ON public.ai_conversation_sessions;
DROP POLICY IF EXISTS "Public read appointments" ON public.consultation_appointments;

-- No unauthenticated client may query sensitive conversation or booking records.
REVOKE SELECT, UPDATE ON TABLE public.ai_conversation_sessions FROM anon;
REVOKE SELECT ON TABLE public.consultation_appointments FROM anon;
