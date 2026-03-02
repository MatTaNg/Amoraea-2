-- Interview completion and review tracking on users table.
-- Used for production vs admin flow and returning-user screens.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS interview_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS interview_passed BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_weighted_score DECIMAL(4,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_pillar_scores JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_completed_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interview_reviewed_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN users.interview_completed IS 'True after the gate interview is completed and scored';
COMMENT ON COLUMN users.interview_passed IS 'Gate pass/fail from computeGateResult';
COMMENT ON COLUMN users.interview_weighted_score IS 'Weighted average (P1/P3/P5/P6) at completion';
COMMENT ON COLUMN users.interview_pillar_scores IS 'Final pillarScores JSON at completion';
COMMENT ON COLUMN users.interview_completed_at IS 'When the interview was completed';
COMMENT ON COLUMN users.interview_reviewed_at IS 'When an admin marked the application as reviewed';
