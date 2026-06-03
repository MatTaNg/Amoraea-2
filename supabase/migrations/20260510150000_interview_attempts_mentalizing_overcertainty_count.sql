ALTER TABLE interview_attempts
  ADD COLUMN IF NOT EXISTS mentalizing_overcertainty_count smallint DEFAULT 0;
