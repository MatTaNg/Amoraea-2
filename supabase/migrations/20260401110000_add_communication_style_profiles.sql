-- Communication style profiling tables (text + audio derived features).
-- Uses users(id) to match the current codebase convention.

create extension if not exists vector;

create table if not exists communication_style_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,

  -- Text features
  emotional_analytical_score float,
  narrative_conceptual_score float,
  certainty_ambiguity_score float,
  relational_individual_score float,
  emotional_vocab_density float,
  qualifier_density float,
  first_person_ratio float,
  avg_response_length float,

  -- Audio features
  pitch_mean float,
  pitch_range float,
  speech_rate float,
  pause_frequency float,
  energy_variation float,
  emotional_expressiveness float,
  warmth_score float,

  -- Composite/confidence
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

