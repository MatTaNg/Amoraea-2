-- Floor fail previously nulled weighted_score; it must always be computed when pillar scores exist,
-- then passed := false if any assessed marker < 3 OR weighted < 5.0.

CREATE OR REPLACE FUNCTION public.recompute_interview_gate_from_pillar_scores(pillar_scores jsonb)
RETURNS TABLE (weighted_score numeric, passed boolean)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  markers text[] := ARRAY[
    'mentalizing',
    'accountability',
    'contempt',
    'repair',
    'regulation',
    'attunement',
    'appreciation',
    'commitment_threshold'
  ];
  m text;
  raw text;
  v numeric;
  scores numeric[] := ARRAY[]::numeric[];
  has_floor_fail boolean := false;
  n int;
  total numeric;
BEGIN
  IF pillar_scores IS NULL THEN
    weighted_score := NULL;
    passed := false;
    RETURN NEXT;
    RETURN;
  END IF;

  FOREACH m IN ARRAY markers LOOP
    raw := pillar_scores ->> m;
    IF raw IS NULL OR btrim(raw) = '' THEN
      CONTINUE;
    END IF;
    BEGIN
      v := raw::numeric;
    EXCEPTION
      WHEN invalid_text_representation THEN
        CONTINUE;
    END;

    IF v IS NULL OR v <= 0 THEN
      CONTINUE;
    END IF;

    scores := array_append(scores, v);
    IF v < 3 THEN
      has_floor_fail := true;
    END IF;
  END LOOP;

  n := coalesce(array_length(scores, 1), 0);
  IF n = 0 THEN
    weighted_score := NULL;
    passed := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT coalesce(sum(x), 0) INTO total FROM unnest(scores) AS x;
  weighted_score := round(total / n::numeric, 1);
  passed := (NOT has_floor_fail) AND (weighted_score >= 5.0);
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.recompute_interview_gate_from_pillar_scores(jsonb) IS
  'Mean of assessed constructs (score > 0); weighted_score always set when any assessed; passed only if no floor fail (<3) and mean >= 5.0.';

UPDATE public.interview_attempts ia
SET
  weighted_score = r.weighted_score,
  passed = r.passed
FROM LATERAL public.recompute_interview_gate_from_pillar_scores(ia.pillar_scores) AS r
WHERE ia.pillar_scores IS NOT NULL;

UPDATE public.users u
SET
  interview_weighted_score = ia.weighted_score,
  interview_passed = ia.passed
FROM public.interview_attempts ia
WHERE u.latest_attempt_id = ia.id
  AND u.interview_completed IS TRUE;

UPDATE public.users u
SET
  interview_weighted_score = r.weighted_score,
  interview_passed = r.passed
FROM LATERAL public.recompute_interview_gate_from_pillar_scores(u.interview_pillar_scores) AS r
WHERE u.interview_completed IS TRUE
  AND u.latest_attempt_id IS NULL
  AND u.interview_pillar_scores IS NOT NULL;
