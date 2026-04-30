-- Interview pass: preserve gate result in `interview_passed_computed`, optional admin override in
-- `interview_passed_admin_override`, and keep `interview_passed` as the effective value for app routing
-- (COALESCE(override, computed) when both are set; see client / edge functions).
-- Cohort "reviewed" is an admin-only flag (separate from application interview_reviewed_at).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS interview_passed_computed boolean,
  ADD COLUMN IF NOT EXISTS interview_passed_admin_override boolean,
  ADD COLUMN IF NOT EXISTS interview_cohort_admin_reviewed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.interview_passed_computed IS
  'Last gate pass/fail from scoring (not overridden by admin).';
COMMENT ON COLUMN public.users.interview_passed_admin_override IS
  'When set, `interview_passed` should match this for routing; when null, use `interview_passed_computed`.';
COMMENT ON COLUMN public.users.interview_cohort_admin_reviewed IS
  'Admin dashboard: user row marked reviewed (not shown to the interviewee).';

-- Backfill computed from historical effective pass where we had a definitive result.
UPDATE public.users
SET interview_passed_computed = interview_passed
WHERE interview_passed IS NOT NULL
  AND interview_passed_computed IS NULL;

-- Admin can update cohort / override fields (and any column) when acting as Amoraea admin.
DROP POLICY IF EXISTS "Amoraea admin can update all users" ON public.users;
CREATE POLICY "Amoraea admin can update all users"
  ON public.users FOR UPDATE TO authenticated
  USING (public.is_amoraea_admin())
  WITH CHECK (public.is_amoraea_admin());
