-- Tracks which scenario (1–3) is currently in progress for resume after dropout.
-- Set when a scenario's content begins; cleared when scenario checkpoint scores are saved.

ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS resume_active_scenario smallint NULL;

COMMENT ON COLUMN public.interview_attempts.resume_active_scenario IS
  'Scenario 1–3 in progress: set at scenario start, cleared when scenario scores are checkpointed to users.';
