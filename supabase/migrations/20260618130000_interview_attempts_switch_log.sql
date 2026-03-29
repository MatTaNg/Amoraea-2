-- Add switch_log column for Alpha Layer 1 scenario-switch tracking.
ALTER TABLE interview_attempts
  ADD COLUMN IF NOT EXISTS switch_log jsonb;

COMMENT ON COLUMN interview_attempts.switch_log IS 'Alpha: log of scenario switches for Layer 1 data';
