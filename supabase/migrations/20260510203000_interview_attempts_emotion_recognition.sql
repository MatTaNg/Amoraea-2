ALTER TABLE interview_attempts
  ADD COLUMN IF NOT EXISTS emotion_recognition_raw_score double precision,
  ADD COLUMN IF NOT EXISTS emotion_recognition_score smallint,
  ADD COLUMN IF NOT EXISTS emotion_recognition_responses text[];
