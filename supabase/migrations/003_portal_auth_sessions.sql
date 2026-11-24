-- ============================================================================
-- OPHIREUM MULTIMEDIA CLIENT AUTHENTICATION SESSIONS
-- Apply only after 002_client_portal_commerce.sql.
-- This migration is intentionally committed to source control only; it has NOT
-- been applied to any hosted Supabase project.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.portal_auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  user_agent TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT portal_auth_sessions_expiry_check CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_portal_auth_sessions_user_active
  ON public.portal_auth_sessions(user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_portal_auth_sessions_expiry
  ON public.portal_auth_sessions(expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.portal_auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_auth_sessions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portal_auth_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.portal_auth_sessions TO authenticated;
GRANT ALL ON TABLE public.portal_auth_sessions TO service_role;

DROP POLICY IF EXISTS "Clients read only their own auth sessions" ON public.portal_auth_sessions;
CREATE POLICY "Clients read only their own auth sessions"
  ON public.portal_auth_sessions
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = user_id);

-- Client writes are intentionally absent. Session creation, rotation and
-- revocation are performed only by the trusted Express API using service_role.

COMMIT;
