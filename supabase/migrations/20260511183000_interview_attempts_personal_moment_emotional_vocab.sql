ALTER TABLE interview_attempts
  ADD COLUMN IF NOT EXISTS personal_moment_emotional_vocab_low boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS personal_moment_emotional_vocab_density double precision;
