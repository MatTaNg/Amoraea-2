-- One-off operational migration: full AI interview reset for mattang5280@gmail.com.
-- Deletes interview_attempts + communication_style_profiles for that user and clears interview
-- columns on public.users (same field set as apply_six_month_interview_cooling_reset).
--
-- Does not delete session_logs or interview_feedback rows (attempt_id becomes NULL on attempt delete).

DO $$
DECLARE
  target_email constant text := 'mattang5280@gmail.com';
  uid uuid;
BEGIN
  SELECT au.id
  INTO uid
  FROM auth.users au
  WHERE lower(trim(au.email)) = lower(trim(target_email));

  IF uid IS NULL THEN
    RAISE EXCEPTION 'reset_interview: no auth.users row for email %', target_email;
  END IF;

  UPDATE public.users
  SET latest_attempt_id = NULL
  WHERE id = uid;

  DELETE FROM public.interview_attempts
  WHERE user_id = uid;

  DELETE FROM public.communication_style_profiles
  WHERE user_id = uid;

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
  WHERE id = uid;

  RAISE NOTICE 'reset_interview: cleared interview state for % (user_id=%)', target_email, uid;
END;
$$;
