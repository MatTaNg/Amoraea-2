-- Recompute weighted_score / passed using equal weight over assessed constructs only.
-- Unassessed markers (null, non-numeric, or <= 0) are excluded from numerator and denominator
-- so a 0 "not assessed" regulation score no longer drags the average down.

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

  IF has_floor_fail THEN
    weighted_score := NULL;
    passed := false;
    RETURN NEXT;
    RETURN;
  END IF;

  n := coalesce(array_length(scores, 1), 0);
  IF n = 0 THEN
    weighted_score := NULL;
    passed := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT coalesce(sum(x), 0) INTO total FROM unnest(scores) AS x;
  weighted_score := round(total / n::numeric, 1);
  passed := weighted_score >= 5.0;
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.recompute_interview_gate_from_pillar_scores(jsonb) IS
  'Gate helper: mean of assessed constructs only (score > 0); floor fail if any assessed < 3.';

-- Idempotent: some remotes skipped 20260228100000_interview_completion_columns.sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS interview_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS interview_passed BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_weighted_score DECIMAL(4,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_pillar_scores JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_completed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_reviewed_at TIMESTAMPTZ DEFAULT NULL;

-- Subquery form: PostgreSQL rejects UPDATE target alias inside FROM LATERAL (42P10).
UPDATE public.interview_attempts ia
SET
  weighted_score = sub.weighted_score,
  passed = sub.passed
FROM (
  SELECT
    t.id,
    r.weighted_score,
    r.passed
  FROM public.interview_attempts t,
  LATERAL public.recompute_interview_gate_from_pillar_scores(t.pillar_scores) AS r
  WHERE t.pillar_scores IS NOT NULL
) AS sub
WHERE ia.id = sub.id;

UPDATE public.users u
SET
  interview_weighted_score = ia.weighted_score,
  interview_passed = ia.passed
FROM public.interview_attempts ia
WHERE u.latest_attempt_id = ia.id
  AND u.interview_completed IS TRUE;

UPDATE public.users u
SET
  interview_weighted_score = sub.weighted_score,
  interview_passed = sub.passed
FROM (
  SELECT
    t.id,
    r.weighted_score,
    r.passed
  FROM public.users t,
  LATERAL public.recompute_interview_gate_from_pillar_scores(t.interview_pillar_scores) AS r
  WHERE t.interview_completed IS TRUE
    AND t.latest_attempt_id IS NULL
    AND t.interview_pillar_scores IS NOT NULL
) AS sub
WHERE u.id = sub.id;

COMMENT ON COLUMN public.users.interview_weighted_score IS
  'Mean of assessed relationship markers at completion (unassessed / 0 excluded from average); threshold 5.0';
