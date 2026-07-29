-- Server-side validation for users.profile_prompts (max 3, 150-char answers, required category floor).
CREATE OR REPLACE FUNCTION public.validate_profile_prompts_payload(payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  elem jsonb;
  prompt_id text;
  answer text;
  cnt integer := 0;
  seen_ids text[] := ARRAY[]::text[];
  has_required boolean := false;
  required_ids text[] := ARRAY[
    'wmtm_partnership','wmtm_non_negotiable','wmtm_supported','wmtm_security','wmtm_conflict',
    'wmtm_trust','wmtm_growth','wmtm_values_daily','wmtm_commitment','wmtm_reciprocity',
    'wmtm_boundaries','wmtm_love_language','wmtm_future',
    'his_stress','his_apology','his_repair','his_feedback','his_vulnerability','his_accountability',
    'his_space','his_communication','his_affection','his_triggers','his_needs','his_patterns','his_best_self'
  ];
BEGIN
  -- Allow null/empty while onboarding is in progress; validate fully when non-empty.
  IF payload IS NULL OR payload = '[]'::jsonb THEN
    RETURN true;
  END IF;
  IF jsonb_typeof(payload) <> 'array' THEN
    RETURN false;
  END IF;

  FOR elem IN SELECT value FROM jsonb_array_elements(payload)
  LOOP
    cnt := cnt + 1;
    IF cnt > 3 THEN
      RETURN false;
    END IF;
    IF jsonb_typeof(elem) <> 'object' THEN
      RETURN false;
    END IF;
    prompt_id := trim(both from coalesce(elem->>'promptId', ''));
    answer := trim(both from coalesce(elem->>'answer', ''));
    IF prompt_id = '' OR answer = '' THEN
      RETURN false;
    END IF;
    IF length(answer) > 150 THEN
      RETURN false;
    END IF;
    IF prompt_id = ANY(seen_ids) THEN
      RETURN false;
    END IF;
    seen_ids := array_append(seen_ids, prompt_id);
    IF prompt_id = ANY(required_ids) THEN
      has_required := true;
    END IF;
  END LOOP;

  IF cnt = 0 THEN
    RETURN false;
  END IF;

  RETURN has_required;
END;
$$;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_profile_prompts_valid;

ALTER TABLE public.users
  ADD CONSTRAINT users_profile_prompts_valid
  CHECK (public.validate_profile_prompts_payload(profile_prompts));

COMMENT ON FUNCTION public.validate_profile_prompts_payload(jsonb) IS
  'Validates profile_prompts: 1-3 items, unique promptId, non-empty answer <=150 chars, >=1 required-category prompt.';
