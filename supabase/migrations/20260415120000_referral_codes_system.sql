-- Referral codes (post-interview handoff) — distinct from 6-char invite_code and alpha tester code MTRX-7K2P.

CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  referrer_user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  fulfilled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_referrer ON public.referral_codes (referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_referred ON public.referral_codes (referred_user_id) WHERE referred_user_id IS NOT NULL;

-- One shareable code row per referrer (fulfilled or not).
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_one_per_referrer ON public.referral_codes (referrer_user_id);

COMMENT ON TABLE public.referral_codes IS '8-char shareable codes (XXX-XXXX); fulfilled when referred user completes interview.';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pending_referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referral_boost_active BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS referral_notice_pending TEXT;

COMMENT ON COLUMN public.users.pending_referral_code IS 'Normalized referral code captured at signup; cleared after fulfillment.';
COMMENT ON COLUMN public.users.referral_boost_active IS 'When true, weighted gate pass threshold is 5.5 instead of 6.0 (floors unchanged).';
COMMENT ON COLUMN public.users.referral_notice_pending IS 'One-shot in-app copy when someone you referred finished their interview.';

-- Normalize shareable referral: 7 alphanumeric → XXX-XXXX (hyphen is display-only)
CREATE OR REPLACE FUNCTION public.normalize_referral_code(p_raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  alnum TEXT;
BEGIN
  IF p_raw IS NULL THEN RETURN NULL; END IF;
  alnum := UPPER(REGEXP_REPLACE(TRIM(p_raw), '[^A-Z0-9]', '', 'g'));
  IF LENGTH(alnum) <> 7 THEN RETURN NULL; END IF;
  RETURN SUBSTRING(alnum FROM 1 FOR 3) || '-' || SUBSTRING(alnum FROM 4 FOR 4);
END;
$$;

-- Anonymous / pre-auth validation for registration UI (existence + unfulfilled only)
CREATE OR REPLACE FUNCTION public.referral_code_is_available(p_raw TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.referral_codes rc
    WHERE rc.code = public.normalize_referral_code(p_raw)
      AND rc.fulfilled = FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public.referral_code_is_available(TEXT) TO anon, authenticated;

-- Fulfill pending referral after interview; apply boosts; notify referrer (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.fulfill_referral_after_interview(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending TEXT;
  v_norm TEXT;
  v_row RECORD;
  v_ref UUID;
BEGIN
  SELECT pending_referral_code INTO v_pending FROM public.users WHERE id = p_user_id;
  IF v_pending IS NULL OR LENGTH(TRIM(v_pending)) = 0 THEN
    RETURN FALSE;
  END IF;

  v_norm := public.normalize_referral_code(v_pending);
  IF v_norm IS NULL THEN
    UPDATE public.users SET pending_referral_code = NULL WHERE id = p_user_id;
    RETURN FALSE;
  END IF;

  SELECT * INTO v_row
  FROM public.referral_codes
  WHERE code = v_norm AND fulfilled = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.users SET pending_referral_code = NULL WHERE id = p_user_id;
    RETURN FALSE;
  END IF;

  v_ref := v_row.referrer_user_id;
  IF v_ref = p_user_id THEN
    UPDATE public.users SET pending_referral_code = NULL WHERE id = p_user_id;
    RETURN FALSE;
  END IF;

  UPDATE public.referral_codes
  SET fulfilled = TRUE,
      referred_user_id = p_user_id
  WHERE id = v_row.id;

  UPDATE public.users
  SET referral_boost_active = TRUE,
      pending_referral_code = NULL
  WHERE id = p_user_id;

  UPDATE public.users
  SET referral_boost_active = TRUE,
      referral_notice_pending = 'Someone you referred has completed their interview. You both now have a better chance of getting accepted.'
  WHERE id = v_ref;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fulfill_referral_after_interview(UUID) TO authenticated;

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own referral rows as referrer" ON public.referral_codes;
DROP POLICY IF EXISTS "Users insert own referral code row" ON public.referral_codes;

CREATE POLICY "Users read own referral rows as referrer"
  ON public.referral_codes FOR SELECT
  TO authenticated
  USING (referrer_user_id = auth.uid());

CREATE POLICY "Users insert own referral code row"
  ON public.referral_codes FOR INSERT
  TO authenticated
  WITH CHECK (referrer_user_id = auth.uid());
