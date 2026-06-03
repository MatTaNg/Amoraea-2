ALTER TABLE interview_attempts
  ADD COLUMN IF NOT EXISTS ego_development_level smallint,
  ADD COLUMN IF NOT EXISTS review_flags jsonb DEFAULT '[]'::jsonb;
