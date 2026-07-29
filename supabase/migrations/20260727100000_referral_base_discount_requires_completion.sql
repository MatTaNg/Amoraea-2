-- Base 40% completion discount (and referred signup bonus) apply only after both the
-- AI interview and psychometric battery are finished.

-- Return type adds `fully_complete`; Postgres requires drop before replace.
DROP FUNCTION IF EXISTS public.get_referral_discount_status(UUID);

CREATE FUNCTION public.get_referral_discount_status(p_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  referral_code TEXT,
  signed_up_with_referral BOOLEAN,
  completed_referrals INTEGER,
  progress_current INTEGER,
  progress_total INTEGER,
  remaining_referrals_to_cap INTEGER,
  total_discount INTEGER,
  at_cap BOOLEAN,
  fully_complete BOOLEAN
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
      u.psychometrics_completed_at,
      (u.interview_completed = TRUE AND u.psychometrics_completed_at IS NOT NULL) AS fully_complete
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
      me.fully_complete,
      counts.completed_referrals,
      CASE WHEN me.signed_up_with_referral THEN 2 ELSE 3 END AS progress_total,
      LEAST(
        100,
        CASE WHEN me.fully_complete THEN 40 ELSE 0 END
        + CASE
            WHEN me.signed_up_with_referral AND me.fully_complete
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
    (derived.total_discount >= 100) AS at_cap,
    derived.fully_complete
  FROM derived;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_discount_status(UUID) TO authenticated;
