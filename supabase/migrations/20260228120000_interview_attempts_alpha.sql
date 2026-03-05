-- Alpha: interview_attempts table and users cache columns.
-- Supports multiple attempts per user, Layer 1/2 data, AI reasoning, user feedback.
-- Remove or gate before production.

CREATE TABLE IF NOT EXISTS interview_attempts (
  id                          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_number              integer NOT NULL DEFAULT 1,
  created_at                  timestamptz DEFAULT now(),
  completed_at                timestamptz,

  weighted_score              decimal(4,2),
  passed                      boolean,
  pillar_scores               jsonb,
  scenario_1_scores           jsonb,
  scenario_2_scores           jsonb,
  scenario_3_scores           jsonb,
  transcript                  jsonb,

  response_timings            jsonb,
  probe_log                   jsonb,
  dropout_point               jsonb,
  score_consistency           jsonb,
  construct_asymmetry         jsonb,
  language_markers            jsonb,
  scenario_specific_patterns  jsonb,

  ai_reasoning                jsonb,

  user_analysis_rating        integer,
  user_analysis_comment       text,
  user_analysis_submitted_at  timestamptz,
  per_construct_ratings      jsonb,

  reviewed_at                 timestamptz,
  reviewed_by                 text
);

CREATE INDEX IF NOT EXISTS idx_interview_attempts_user_id ON interview_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_user_created ON interview_attempts(user_id, created_at DESC);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS interview_attempt_count integer DEFAULT 0;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS latest_attempt_id uuid REFERENCES interview_attempts(id);

COMMENT ON TABLE interview_attempts IS 'Alpha: one row per interview attempt; supports retakes and full assessment data';
COMMENT ON COLUMN users.interview_attempt_count IS 'Alpha: total number of interview attempts';
COMMENT ON COLUMN users.latest_attempt_id IS 'Alpha: FK to most recent completed attempt';
