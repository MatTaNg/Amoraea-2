-- Weighted-score audit trail + regulation source metadata (evaluation / admin).

ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS weighted_score_breakdown jsonb;

COMMENT ON COLUMN public.interview_attempts.weighted_score_breakdown IS
  'Per-pillar gate contribution (score, nominal weight, contribution) plus raw weighted, depth modifier, psychometric modifier, and final modified score.';

ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS regulation_source_signals jsonb;

COMMENT ON COLUMN public.interview_attempts.regulation_source_signals IS
  'Per-moment regulation scores (S1, S3, M4, M5, support). Missing sources are null, not zero.';
