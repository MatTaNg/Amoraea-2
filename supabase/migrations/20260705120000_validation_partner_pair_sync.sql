-- Validation partner pairing runs in the client but must resolve partner user ids and
-- psychometrics completion across users — blocked by default users / validation RLS.

CREATE OR REPLACE FUNCTION public.is_validation_paired_with(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.relationship_validation_comparisons c
    WHERE c.user_id = auth.uid()
      AND c.partner_user_id = target_user_id
      AND c.pair_confirmed_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_validation_paired_with(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_validation_paired_with(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_validation_paired_with(uuid) IS
  'True when the current user has a confirmed validation comparison with target_user_id.';

DROP POLICY IF EXISTS users_select_validation_paired_partner ON public.users;
CREATE POLICY users_select_validation_paired_partner
  ON public.users
  FOR SELECT
  TO authenticated
  USING (public.is_validation_paired_with(id));

DROP POLICY IF EXISTS relationship_validation_records_select_paired_partner ON public.relationship_validation_records;
CREATE POLICY relationship_validation_records_select_paired_partner
  ON public.relationship_validation_records
  FOR SELECT
  TO authenticated
  USING (public.is_validation_paired_with(user_id));

CREATE OR REPLACE FUNCTION public.sync_validation_partner_pair()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_self_email text;
  v_comparison public.relationship_validation_comparisons%ROWTYPE;
  v_partner_uid uuid;
  v_partner_comparison_id uuid;
  v_self_psych timestamptz;
  v_partner_psych timestamptz;
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('confirmed', false, 'reason', 'not_authenticated');
  END IF;

  SELECT lower(trim(email)) INTO v_self_email
  FROM auth.users
  WHERE id = v_uid;

  IF v_self_email IS NULL OR v_self_email = '' THEN
    RETURN jsonb_build_object('confirmed', false, 'reason', 'no_self_email');
  END IF;

  SELECT c.* INTO v_comparison
  FROM public.relationship_validation_records r
  JOIN public.relationship_validation_comparisons c ON c.id = r.active_comparison_id
  WHERE r.user_id = v_uid
  LIMIT 1;

  IF v_comparison.id IS NULL THEN
    RETURN jsonb_build_object('confirmed', false, 'reason', 'no_active_comparison');
  END IF;

  IF v_comparison.partner_email_entered IS NULL OR trim(v_comparison.partner_email_entered) = '' THEN
    RETURN jsonb_build_object('confirmed', false, 'reason', 'no_partner_email');
  END IF;

  SELECT u.id INTO v_partner_uid
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim(v_comparison.partner_email_entered))
  LIMIT 1;

  IF v_partner_uid IS NULL THEN
    RETURN jsonb_build_object(
      'confirmed', false,
      'reason', 'partner_not_registered',
      'self_comparison_id', v_comparison.id
    );
  END IF;

  SELECT c.id INTO v_partner_comparison_id
  FROM public.relationship_validation_comparisons c
  WHERE c.user_id = v_partner_uid
    AND lower(trim(c.partner_email_entered)) = v_self_email
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF v_partner_comparison_id IS NULL THEN
    RETURN jsonb_build_object(
      'confirmed', false,
      'reason', 'partner_has_not_entered_your_email',
      'partner_user_id', v_partner_uid,
      'self_comparison_id', v_comparison.id
    );
  END IF;

  UPDATE public.relationship_validation_comparisons
  SET
    partner_user_id = v_partner_uid,
    pair_confirmed_at = COALESCE(pair_confirmed_at, v_now),
    updated_at = v_now
  WHERE id = v_comparison.id;

  UPDATE public.relationship_validation_comparisons
  SET
    partner_user_id = v_uid,
    pair_confirmed_at = COALESCE(pair_confirmed_at, v_now),
    updated_at = v_now
  WHERE id = v_partner_comparison_id;

  SELECT psychometrics_completed_at INTO v_self_psych
  FROM public.relationship_validation_records
  WHERE user_id = v_uid;

  SELECT psychometrics_completed_at INTO v_partner_psych
  FROM public.relationship_validation_records
  WHERE user_id = v_partner_uid;

  RETURN jsonb_build_object(
    'confirmed', true,
    'partner_user_id', v_partner_uid,
    'self_comparison_id', v_comparison.id,
    'partner_comparison_id', v_partner_comparison_id,
    'self_psychometrics_complete', v_self_psych IS NOT NULL,
    'partner_psychometrics_complete', v_partner_psych IS NOT NULL,
    'partner_complete', v_self_psych IS NOT NULL AND v_partner_psych IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_validation_partner_pair() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_validation_partner_pair() TO authenticated;

COMMENT ON FUNCTION public.sync_validation_partner_pair() IS
  'Mutually links validation comparisons by email and reports psychometrics completion for both partners.';

-- Paired partners need each other's assessment/profile rows for client-side compatibility scoring.
DO $policy$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS profiles_select_validation_paired_partner ON public.profiles';
    EXECUTE $sql$
      CREATE POLICY profiles_select_validation_paired_partner
        ON public.profiles
        FOR SELECT
        TO authenticated
        USING (public.is_validation_paired_with(id))
    $sql$;
  END IF;

  IF to_regclass('public.user_assessments') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS user_assessments_select_validation_paired_partner ON public.user_assessments';
    EXECUTE $sql$
      CREATE POLICY user_assessments_select_validation_paired_partner
        ON public.user_assessments
        FOR SELECT
        TO authenticated
        USING (public.is_validation_paired_with(user_id))
    $sql$;
  END IF;

  IF to_regclass('public.interview_attempts') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS interview_attempts_select_validation_paired_partner ON public.interview_attempts';
    EXECUTE $sql$
      CREATE POLICY interview_attempts_select_validation_paired_partner
        ON public.interview_attempts
        FOR SELECT
        TO authenticated
        USING (public.is_validation_paired_with(user_id))
    $sql$;
  END IF;
END
$policy$;
