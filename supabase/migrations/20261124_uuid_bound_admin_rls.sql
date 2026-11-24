-- Bind administrator RLS authorization exclusively to verified Supabase Auth UUIDs.
-- This forward migration is safe to review independently; do not apply until the
-- exact OMPNETWORK Supabase project and a recoverable backup are confirmed.
BEGIN;

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
      AND au.auth_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_ophireum_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_ophireum_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_ophireum_admin() TO authenticated, service_role;

COMMIT;
