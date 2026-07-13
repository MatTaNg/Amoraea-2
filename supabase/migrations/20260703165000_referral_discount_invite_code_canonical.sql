-- Canonicalize referrals onto users.invite_code / users.referred_by_id and retire the
-- legacy single-fulfillment referral_codes flow.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS invite_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_invite_code ON public.users(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON public.users(referred_by_id);

-- Preserve any legacy shareable-code referrals before dropping the old table/columns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'referral_codes'
  ) THEN
    -- Users who signed up with a legacy shareable code but have not yet completed should still
    -- retain referral attribution and the referred-user boost.
    UPDATE public.users AS referred
    SET referred_by_id = COALESCE(referred.referred_by_id, rc.referrer_user_id),
        referral_boost_active = CASE
          WHEN COALESCE(referred.referred_by_id, rc.referrer_user_id) IS NOT NULL THEN TRUE
          ELSE referred.referral_boost_active
        END
    FROM public.referral_codes AS rc
    WHERE referred.pending_referral_code IS NOT NULL
      AND referred.id <> rc.referrer_user_id
      AND public.normalize_referral_code(referred.pending_referral_code) = rc.code;

    -- Completed legacy referrals become canonical referred_by links.
    UPDATE public.users AS referred
    SET referred_by_id = COALESCE(referred.referred_by_id, rc.referrer_user_id),
        referral_boost_active = TRUE
    FROM public.referral_codes AS rc
    WHERE rc.referred_user_id = referred.id
      AND rc.referrer_user_id IS NOT NULL
      AND referred.id <> rc.referrer_user_id;

    -- Legacy completed referrers should keep their referral boost.
    UPDATE public.users AS referrer
    SET referral_boost_active = TRUE
    FROM public.referral_codes AS rc
    WHERE rc.referrer_user_id = referrer.id
      AND rc.referred_user_id IS NOT NULL;
  END IF;
END;
$$;

UPDATE public.users
SET pending_referral_code = NULL
WHERE pending_referral_code IS NOT NULL;

-- Public validation for registration UI against canonical invite codes.
CREATE OR REPLACE FUNCTION public.invite_code_is_available(p_raw TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.invite_code = UPPER(TRIM(COALESCE(p_raw, '')))
      AND u.invite_code IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.invite_code_is_available(TEXT) TO anon, authenticated;

-- Best-effort referral side effects after a referred user completes the interview.
CREATE OR REPLACE FUNCTION public.apply_referral_completion_effects(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer UUID;
BEGIN
  SELECT referred_by_id
  INTO v_referrer
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
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
      referral_notice_pending = 'Someone you referred has completed their interview. You both now have a better chance of getting accepted.'
  WHERE id = v_referrer;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_referral_completion_effects(UUID) TO authenticated;

-- Secure summary for client referral discount UI.
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
      (u.referred_by_id IS NOT NULL) AS signed_up_with_referral
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
        + CASE WHEN me.signed_up_with_referral THEN 20 ELSE 0 END
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

GRANT EXECUTE ON FUNCTION public.get_referral_discount_status(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.referral_code_is_available(TEXT);
DROP FUNCTION IF EXISTS public.fulfill_referral_after_interview(UUID);
DROP FUNCTION IF EXISTS public.normalize_referral_code(TEXT);
DROP TABLE IF EXISTS public.referral_codes;

ALTER TABLE public.users
  DROP COLUMN IF EXISTS pending_referral_code;
