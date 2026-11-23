-- Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
-- Developer and claimed rights holder: Ophireum Multimedia Production
-- DTI-registered business, Philippines | Registration No. 7567003
-- SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
-- SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
-- Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.
--
-- Bind administrator RLS authorization exclusively to the verified Supabase Auth UUID.
-- This migration intentionally does not auto-provision or promote any administrator.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_ophireum_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.is_active = TRUE
        AND au.auth_user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.is_ophireum_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_ophireum_admin() TO authenticated, service_role;

COMMIT;
