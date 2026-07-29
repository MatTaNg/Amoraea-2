-- Referral 20% step bonuses require the referred user to finish both the AI interview
-- and the psychometric battery before counting toward either party's discount.

CREATE OR REPLACE FUNCTION public.apply_referral_completion_effects(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer UUID;
  v_fully_complete BOOLEAN;
BEGIN
  SELECT
    referred_by_id,
    (interview_completed = TRUE AND psychometrics_completed_at IS NOT NULL)
  INTO v_referrer, v_fully_complete
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND OR NOT COALESCE(v_fully_complete, FALSE) THEN
    RETURN FALSE;
  END IF;

  UPDATE public.users
  SET referral_boost_active = TRUE
  WHERE id = p_user_id
    AND referral_boost_active IS DISTINCT FROM TRUE;

  IF v_referrer IS NULL OR v_referrer = p_user_id THEN
    RETURN FALSE;
  END IF;

  UPDATE public.users
  SET referral_boost_active = TRUE,
      referral_notice_pending = 'Someone you referred has completed the interview and psychometric assessments. You both now receive an additional 20% discount on future subscriptions.'
  WHERE id = v_referrer;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_referral_discount_status(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  referral_code TEXT,
  signed_up_with_referral BOOLEAN,
  completed_referrals INTEGER,
  progress_current INTEGER,
  progress_total INTEGER,
  remaining_referrals_to_cap INTEGER,
  total_discount INTEGER,
  at_cap BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT
      u.id,
      u.invite_code,
      (u.referred_by_id IS NOT NULL) AS signed_up_with_referral,
      u.interview_completed,
      u.psychometrics_completed_at
    FROM public.users u
    WHERE u.id = COALESCE(p_user_id, auth.uid())
  ),
  counts AS (
    SELECT
      me.id,
      COUNT(referred.id)::INT AS completed_referrals
    FROM me
    LEFT JOIN public.users AS referred
      ON referred.referred_by_id = me.id
     AND referred.interview_completed = TRUE
     AND referred.psychometrics_completed_at IS NOT NULL
    GROUP BY me.id
  ),
  derived AS (
    SELECT
      me.invite_code AS referral_code,
      me.signed_up_with_referral,
      counts.completed_referrals,
      CASE WHEN me.signed_up_with_referral THEN 2 ELSE 3 END AS progress_total,
      LEAST(
        100,
        40
        + CASE
            WHEN me.signed_up_with_referral
             AND me.interview_completed = TRUE
             AND me.psychometrics_completed_at IS NOT NULL
            THEN 20
            ELSE 0
          END
        + (counts.completed_referrals * 20)
      )::INT AS total_discount
    FROM me
    JOIN counts ON counts.id = me.id
  )
  SELECT
    derived.referral_code,
    derived.signed_up_with_referral,
    derived.completed_referrals,
    LEAST(derived.completed_referrals, derived.progress_total)::INT AS progress_current,
    derived.progress_total::INT,
    GREATEST(derived.progress_total - LEAST(derived.completed_referrals, derived.progress_total), 0)::INT AS remaining_referrals_to_cap,
    derived.total_discount,
    (derived.total_discount >= 100) AS at_cap
  FROM derived;
$$;
