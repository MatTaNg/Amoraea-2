ALTER TABLE interview_attempts
  ADD COLUMN IF NOT EXISTS defense_patterns jsonb DEFAULT '{}'::jsonb;
