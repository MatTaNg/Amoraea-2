-- Onboarding gates: stage, application status, and gate payloads
-- Stages: basic_info | interview | psychometrics | compatibility | complete

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_stage TEXT DEFAULT 'basic_info',
  ADD COLUMN IF NOT EXISTS application_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS profile_visible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS basic_info JSONB,
  ADD COLUMN IF NOT EXISTS gate1_score JSONB,
  ADD COLUMN IF NOT EXISTS gate2_psychometrics JSONB,
  ADD COLUMN IF NOT EXISTS gate3_compatibility JSONB;

COMMENT ON COLUMN users.onboarding_stage IS 'basic_info | interview | psychometrics | compatibility | complete';
COMMENT ON COLUMN users.application_status IS 'pending | under_review | approved';
COMMENT ON COLUMN users.profile_visible IS 'false until onboarding complete';
COMMENT ON COLUMN users.basic_info IS 'Stage 1: firstName, age, gender, locationCity, locationCountry, photoUrl, heightCm, weightKg, bmi';
COMMENT ON COLUMN users.gate1_score IS 'Interview scoring + evaluateGate1 result';
COMMENT ON COLUMN users.gate2_psychometrics IS 'ECR-12, TIPI, DSI-SF, BRS, PVQ-21 scores';
COMMENT ON COLUMN users.gate3_compatibility IS 'Compatibility answers + preferredMinBMI, preferredMaxBMI, profilePrompts';
