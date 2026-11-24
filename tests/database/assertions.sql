-- Assertions against the disposable CI database.
DO $$
DECLARE
  session_rls BOOLEAN;
  profile_rls BOOLEAN;
  anon_select BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO session_rls
    FROM pg_class WHERE oid = 'public.portal_auth_sessions'::regclass;
  SELECT relrowsecurity INTO profile_rls
    FROM pg_class WHERE oid = 'public.profiles'::regclass;
  IF NOT session_rls OR NOT profile_rls THEN
    RAISE EXCEPTION 'RLS is not enabled on profiles and portal_auth_sessions';
  END IF;

  SELECT has_table_privilege('anon', 'public.profiles', 'SELECT') INTO anon_select;
  IF anon_select THEN RAISE EXCEPTION 'anon unexpectedly has SELECT on profiles'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles'
      AND policyname='Client reads own profile' AND cmd='SELECT'
  ) THEN RAISE EXCEPTION 'Expected owner-only profiles policy is missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='portal_auth_sessions'
      AND policyname='Clients read only their own auth sessions' AND cmd='SELECT'
  ) THEN RAISE EXCEPTION 'Expected owner-only session policy is missing'; END IF;
END $$;

INSERT INTO auth.users (id, email) VALUES
  ('10000000-0000-4000-8000-000000000001', 'client-a@example.test'),
  ('20000000-0000-4000-8000-000000000002', 'client-b@example.test');
INSERT INTO public.profiles (user_id, email, first_name, last_name) VALUES
  ('10000000-0000-4000-8000-000000000001', 'client-a@example.test', 'Client', 'A'),
  ('20000000-0000-4000-8000-000000000002', 'client-b@example.test', 'Client', 'B');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
DO $$
DECLARE visible_rows INTEGER;
BEGIN
  SELECT count(*) INTO visible_rows FROM public.profiles;
  IF visible_rows <> 1 THEN RAISE EXCEPTION 'Client A expected 1 own profile row, saw %', visible_rows; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email='client-b@example.test') THEN
    RAISE EXCEPTION 'Client A can read Client B profile';
  END IF;
END $$;
RESET ROLE;

SELECT 'PASS: migrations applied; RLS enabled; anon denied; owner isolation verified' AS result;
