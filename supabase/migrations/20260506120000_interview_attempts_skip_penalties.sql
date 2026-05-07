-- Scenario skip penalties + silent third-skip auto-fail (stored for scoring / audit).

ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS skip_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skip_penalties jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS skip_penalty_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_failed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_fail_reason text;

COMMENT ON COLUMN public.interview_attempts.skip_count IS 'Confirmed scenario skips (moments 1–3), max 3';
COMMENT ON COLUMN public.interview_attempts.skip_penalties IS 'Per skip amounts: -0.3, -0.6, null for third (auto-fail)';
COMMENT ON COLUMN public.interview_attempts.skip_penalty_total IS 'Sum of numeric penalties only (third skip does not add)';
COMMENT ON COLUMN public.interview_attempts.auto_failed IS 'Third skip: predetermined fail without UI disclosure';
COMMENT ON COLUMN public.interview_attempts.auto_fail_reason IS 'e.g. exceeded_skip_limit';
