-- Gaming correction fields on interview_attempts for graduated psychometric modifier correction.
ALTER TABLE interview_attempts
  ADD COLUMN IF NOT EXISTS gaming_correction jsonb,
  ADD COLUMN IF NOT EXISTS corrected_psychometric_modifier numeric;

COMMENT ON COLUMN interview_attempts.gaming_correction IS
  'Full GamingCorrectionResult: correction level, stripped instruments, triggers, explanation.';
COMMENT ON COLUMN interview_attempts.corrected_psychometric_modifier IS
  'Psychometric modifier after gaming correction (positives stripped, penalties applied).';
