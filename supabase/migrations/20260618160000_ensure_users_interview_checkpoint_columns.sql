-- Idempotent: some production DBs never applied 20260228110000_interview_checkpoint_columns.sql.
-- Without these columns, PostgREST returns 42703 when the app selects them (e.g. admin panel).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS interview_transcript JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_scenario_1_scores JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_scenario_2_scores JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_scenario_3_scores JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_last_checkpoint INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.users.interview_transcript IS 'Transcript snapshot (no score cards) at last scenario checkpoint or live sync';
COMMENT ON COLUMN public.users.interview_last_checkpoint IS 'Last completed scenario number (1, 2, or 3)';
