-- Allow admin console to update ai_reasoning / reasoning_pending when retrying narrative generation from the dashboard.

DROP POLICY IF EXISTS "interview_attempts_authenticated_update_admin" ON public.interview_attempts;

CREATE POLICY "interview_attempts_authenticated_update_admin"
  ON public.interview_attempts FOR UPDATE TO authenticated
  USING (
    lower(trim(coalesce((select auth.jwt() ->> 'email'), ''))) = 'admin@amoraea.com'
  )
  WITH CHECK (
    lower(trim(coalesce((select auth.jwt() ->> 'email'), ''))) = 'admin@amoraea.com'
  );
