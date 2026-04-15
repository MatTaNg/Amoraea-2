-- Remotes that never applied 20260401113000 (migration history drift) may lack this table.
-- Idempotent: safe if table already exists.

CREATE TABLE IF NOT EXISTS public.interview_turn_audio_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES public.interview_attempts(id) ON DELETE CASCADE,
  session_id text NOT NULL,
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
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_turn_audio_features_user_attempt
  ON public.interview_turn_audio_features(user_id, attempt_id);

CREATE INDEX IF NOT EXISTS idx_turn_audio_features_session
  ON public.interview_turn_audio_features(user_id, session_id, created_at);
