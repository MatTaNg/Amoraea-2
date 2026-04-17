-- When AI narrative reasoning fails after retries, we still persist scores/transcript and flag for retry (admin or batch).

ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS reasoning_pending boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.interview_attempts.reasoning_pending IS 'True when pillar/transcript were saved but ai_reasoning narrative still needs generation';

CREATE INDEX IF NOT EXISTS idx_interview_attempts_reasoning_pending
  ON public.interview_attempts (reasoning_pending)
  WHERE reasoning_pending = true;
