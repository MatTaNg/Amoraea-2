-- Audit trail when an admin recalculates scores from stored scenario slices.

ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS original_scores jsonb NULL,
  ADD COLUMN IF NOT EXISTS recalculated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS recalculation_delta jsonb NULL,
  ADD COLUMN IF NOT EXISTS recalculation_notes text[] NULL;

COMMENT ON COLUMN public.interview_attempts.original_scores IS
  'Snapshot of pillar_scores, weighted_score, passed, gate fields before admin recalculation.';
COMMENT ON COLUMN public.interview_attempts.recalculation_delta IS
  'Per-pillar score delta (new minus old) after admin recalculation.';
COMMENT ON COLUMN public.interview_attempts.recalculation_notes IS
  'Human-readable notes: completion gate, gate failures, rubric cues.';
