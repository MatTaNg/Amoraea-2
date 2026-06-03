-- Personal-moment concreteness levels from Moment 4 / 5 scorers (absent | low | moderate | high).
ALTER TABLE interview_attempts
  ADD COLUMN IF NOT EXISTS moment_4_concreteness text,
  ADD COLUMN IF NOT EXISTS moment_5_concreteness text;
