-- Structured production session logs (JSON event_data, queryable by user/attempt/platform/time).

CREATE TABLE IF NOT EXISTS public.session_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES public.interview_attempts(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer,
  error text,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.session_logs IS 'Fire-and-forget interview/session telemetry; event_data holds event-specific JSON.';

CREATE INDEX IF NOT EXISTS idx_session_logs_user_id ON public.session_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_attempt_id ON public.session_logs(attempt_id);
CREATE INDEX IF NOT EXISTS idx_session_logs_created_at ON public.session_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_logs_platform ON public.session_logs(platform);

ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_logs_insert_own"
  ON public.session_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "session_logs_select_own"
  ON public.session_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
