-- Track interview lifecycle for analytics and debugging (not_started → in_progress → completed → scoring).
ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS session_lifecycle text;

COMMENT ON COLUMN public.interview_attempts.session_lifecycle IS
  'Client-driven: not_started | in_progress | completed | scoring — mirrors session state for DB queries';
