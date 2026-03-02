-- Interview checkpoint and transcript columns for two-layer persistence.
-- Used at each scenario completion and as fallback for resumption.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS interview_transcript JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_scenario_1_scores JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_scenario_2_scores JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_scenario_3_scores JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_last_checkpoint INTEGER DEFAULT NULL;

COMMENT ON COLUMN users.interview_transcript IS 'Transcript snapshot (no score cards) at last scenario checkpoint';
COMMENT ON COLUMN users.interview_scenario_1_scores IS 'Scenario 1 score payload at completion';
COMMENT ON COLUMN users.interview_scenario_2_scores IS 'Scenario 2 score payload at completion';
COMMENT ON COLUMN users.interview_scenario_3_scores IS 'Scenario 3 score payload at completion';
COMMENT ON COLUMN users.interview_last_checkpoint IS 'Last completed scenario number (1, 2, or 3)';
