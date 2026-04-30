-- One-off hard reset for mattang5280@gmail.com.
-- Use when a prior reset migration was already applied or when client still routes into
-- a resumed interview flow. This is safe to run once via migration or directly in SQL editor.

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
    RAISE EXCEPTION 'reset_interview_force_intro: no auth.users row for email %', target_email;
  END IF;

  -- Break FK and remove interview artifacts.
  UPDATE public.users
  SET latest_attempt_id = NULL
  WHERE id = uid;

  DELETE FROM public.interview_attempts
  WHERE user_id = uid;

  DELETE FROM public.communication_style_profiles
  WHERE user_id = uid;

  -- Full gate reset + onboarding rewind to intro/interview.
  UPDATE public.users
  SET
    onboarding_completed = FALSE,
    onboarding_step = 1,
    onboarding_stage = 'interview',
    application_status = 'pending',
    gate1_score = NULL,
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
    interview_cohort_admin_reviewed = FALSE
  WHERE id = uid;

  RAISE NOTICE 'reset_interview_force_intro: reset user % (id=%)', target_email, uid;
END;
$$;

