-- Ensure users table has all columns required by ProfileRepository upsert.
-- Run this if you get 400 on POST/upsert to rest/v1/users (e.g. missing column).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS profile_prompts JSONB,
  ADD COLUMN IF NOT EXISTS onboarding_stage TEXT DEFAULT 'basic_info',
  ADD COLUMN IF NOT EXISTS application_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS profile_visible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS basic_info JSONB,
  ADD COLUMN IF NOT EXISTS gate1_score JSONB,
  ADD COLUMN IF NOT EXISTS gate2_psychometrics JSONB,
  ADD COLUMN IF NOT EXISTS gate3_compatibility JSONB;
