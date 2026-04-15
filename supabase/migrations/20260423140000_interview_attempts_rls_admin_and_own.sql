-- Admin dashboard loads all interview_attempts and joins to users in the client. Without a policy for
-- admin@amoraea.com, RLS (or enabling RLS) can restrict SELECT to user_id = auth.uid(), so other users
-- appear with "No tests found" while their rows exist in the table.

ALTER TABLE public.interview_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interview_attempts_authenticated_select_own" ON public.interview_attempts;
DROP POLICY IF EXISTS "interview_attempts_authenticated_select_admin" ON public.interview_attempts;
DROP POLICY IF EXISTS "interview_attempts_authenticated_insert_own" ON public.interview_attempts;
DROP POLICY IF EXISTS "interview_attempts_authenticated_update_own" ON public.interview_attempts;

CREATE POLICY "interview_attempts_authenticated_select_own"
  ON public.interview_attempts FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "interview_attempts_authenticated_select_admin"
  ON public.interview_attempts FOR SELECT TO authenticated
  USING (
    lower(trim(coalesce((select auth.jwt() ->> 'email'), ''))) = 'admin@amoraea.com'
  );

CREATE POLICY "interview_attempts_authenticated_insert_own"
  ON public.interview_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "interview_attempts_authenticated_update_own"
  ON public.interview_attempts FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

COMMENT ON POLICY "interview_attempts_authenticated_select_admin" ON public.interview_attempts IS
  'Admin dashboard: list all attempts. Edge Functions use service role and bypass RLS.';
