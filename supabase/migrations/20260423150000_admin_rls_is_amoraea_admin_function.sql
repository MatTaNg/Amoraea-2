-- RLS policies that use auth.jwt() ->> 'email' often fail in practice: the email claim can be absent or
-- nested in user_metadata depending on provider and Supabase version. Admin then only passes "own row"
-- policies. Use a STABLE SECURITY DEFINER helper that reads email from auth.users (same source as Auth).

CREATE OR REPLACE FUNCTION public.is_amoraea_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND lower(trim(coalesce(email, ''))) = 'admin@amoraea.com'
  );
$$;

REVOKE ALL ON FUNCTION public.is_amoraea_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_amoraea_admin() TO authenticated;

COMMENT ON FUNCTION public.is_amoraea_admin() IS
  'True when the current auth user is admin@amoraea.com; use in RLS instead of auth.jwt() email.';

-- interview_attempts: replace JWT-based admin SELECT with function-based check
DROP POLICY IF EXISTS "interview_attempts_authenticated_select_admin" ON public.interview_attempts;

CREATE POLICY "interview_attempts_authenticated_select_admin"
  ON public.interview_attempts FOR SELECT TO authenticated
  USING (public.is_amoraea_admin());

-- users: align admin SELECT with the same helper (idempotent replace)
DROP POLICY IF EXISTS "Admin email can select all users" ON public.users;

CREATE POLICY "Admin email can select all users"
  ON public.users FOR SELECT TO authenticated
  USING (public.is_amoraea_admin());
