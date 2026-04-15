-- Link communication style profile to the interview attempt that produced it (optional FK).
-- Idempotent base DDL for remotes that skipped 20260401110000 and/or 20260228120000.

do $$
begin
  if to_regclass('public.users') is null then
    raise exception
      'public.users does not exist. Apply core migrations first, starting with '
      '20260209000003_create_users_table.sql (Supabase SQL editor or full db push in order). '
      'Using db push --include-all on a database that skipped February migrations causes this error.';
  end if;
end $$;

-- From 20260228120000_interview_attempts_alpha.sql (idempotent if already applied)
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

create extension if not exists vector;

create table if not exists communication_style_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,

  emotional_analytical_score float,
  narrative_conceptual_score float,
  certainty_ambiguity_score float,
  relational_individual_score float,
  emotional_vocab_density float,
  qualifier_density float,
  first_person_ratio float,
  avg_response_length float,

  pitch_mean float,
  pitch_range float,
  speech_rate float,
  pause_frequency float,
  energy_variation float,
  emotional_expressiveness float,
  warmth_score float,

  text_confidence float,
  audio_confidence float,
  overall_confidence float,
  style_vector vector(8),

  processed_at timestamptz,
  updated_at timestamptz default now()
);

create unique index if not exists idx_communication_style_profiles_user_unique
  on communication_style_profiles(user_id);

create table if not exists style_processing_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  processing_type text,
  status text,
  error_message text,
  features_extracted jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_style_processing_log_user_created
  on style_processing_log(user_id, created_at desc);

alter table communication_style_profiles
  add column if not exists source_attempt_id uuid references interview_attempts(id) on delete set null;

create index if not exists idx_communication_style_profiles_source_attempt
  on communication_style_profiles(source_attempt_id);
