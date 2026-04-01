-- Per-turn audio feature storage for resilient Hume processing.
-- turn rows are written as the interview runs and finalized at completion.

create table if not exists interview_turn_audio_features (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  attempt_id uuid references interview_attempts(id) on delete cascade,
  session_id text not null,
  turn_index integer,
  scenario_number integer,
  pitch_mean float,
  pitch_range float,
  speech_rate float,
  pause_frequency float,
  energy_variation float,
  emotional_expressiveness float,
  warmth_score float,
  audio_duration_seconds float,
  processing_status text,
  error_message text,
  created_at timestamptz default now()
);

create index if not exists idx_turn_audio_features_user_attempt
  on interview_turn_audio_features(user_id, attempt_id);

create index if not exists idx_turn_audio_features_session
  on interview_turn_audio_features(user_id, session_id, created_at);

