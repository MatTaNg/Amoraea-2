-- Admin UPDATE used auth.jwt() ->> 'email' = 'admin@amoraea.com', which can be empty/mismatched while
-- public.is_amoraea_admin() (auth.users email) still passes — then SELECT works but holistic/ego UPDATEs
-- silently affect 0 rows (own-row policy requires auth.uid() = interview_attempts.user_id).

DROP POLICY IF EXISTS "interview_attempts_authenticated_update_admin" ON public.interview_attempts;

CREATE POLICY "interview_attempts_authenticated_update_admin"
  ON public.interview_attempts FOR UPDATE TO authenticated
  USING (public.is_amoraea_admin())
  WITH CHECK (public.is_amoraea_admin());

COMMENT ON POLICY "interview_attempts_authenticated_update_admin" ON public.interview_attempts IS
  'Amoraea admin may update any attempt row (e.g. ai_reasoning, ego_development_level). Uses is_amoraea_admin() so JWT email claim drift does not block updates.';
