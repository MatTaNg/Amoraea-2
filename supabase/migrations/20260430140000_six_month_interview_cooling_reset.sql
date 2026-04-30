-- Six-month cooling: failed interviews become eligible for a clean retake. Clears users interview
-- columns, deletes attempt rows and communication_style_profiles for those users. Schedule the
-- Edge Function `apply-six-month-interview-reset` daily (Dashboard → Edge Functions → Cron).
--
-- Scope: interview_completed, interview_completed_at at least 6 months ago, interview_passed = false.
-- Does not reset admitted members (interview_passed = true).

CREATE OR REPLACE FUNCTION public.apply_six_month_interview_cooling_reset()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int := 0;
  uids uuid[];
BEGIN
  SELECT coalesce(
    (
      SELECT array_agg(id)
      FROM public.users
      WHERE interview_completed IS TRUE
        AND interview_completed_at IS NOT NULL
        AND interview_completed_at <= (timezone('utc', now()) - interval '6 months')
        AND interview_passed IS FALSE
    ),
    ARRAY[]::uuid[]
  )
  INTO uids;

  IF uids = ARRAY[]::uuid[] THEN
    RETURN 0;
  END IF;

  -- Break FK from users.latest_attempt_id before deleting attempts
  UPDATE public.users
  SET latest_attempt_id = NULL
  WHERE id = ANY (uids);

  DELETE FROM public.interview_attempts
  WHERE user_id = ANY (uids);

  DELETE FROM public.communication_style_profiles
  WHERE user_id = ANY (uids);

  UPDATE public.users
  SET
    interview_completed = FALSE,
    interview_passed = NULL,
    interview_passed_computed = NULL,
    interview_passed_admin_override = NULL,
    interview_weighted_score = NULL,
    interview_pillar_scores = NULL,
    interview_completed_at = NULL,
    interview_reviewed_at = NULL,
    interview_last_checkpoint = 0,
    interview_attempt_count = 0,
    latest_attempt_id = NULL,
    interview_transcript = NULL,
    interview_scenario_1_scores = NULL,
    interview_scenario_2_scores = NULL,
    interview_scenario_3_scores = NULL,
    interview_cohort_admin_reviewed = FALSE,
    onboarding_stage = 'interview',
    application_status = 'pending',
    gate1_score = NULL
  WHERE id = ANY (uids);

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION public.apply_six_month_interview_cooling_reset() IS
  'Deletes interview attempts + communication_style_profiles and clears interview fields for users '
  'who failed (interview_passed false) and completed >= 6 months ago. Intended for scheduled invocation only.';

REVOKE ALL ON FUNCTION public.apply_six_month_interview_cooling_reset() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_six_month_interview_cooling_reset() TO service_role;
