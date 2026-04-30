-- Standard onboarding: client saves transcript + client scenario scores, then edge function completes holistic + reasoning + pass.

ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS scoring_deferred boolean NOT NULL DEFAULT false;

ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS interview_typology_context text;

COMMENT ON COLUMN public.interview_attempts.scoring_deferred IS
  'When true, holistic + reasoning + users.interview_passed are completed by complete-standard-interview edge (or cron).';
COMMENT ON COLUMN public.interview_attempts.interview_typology_context IS
  'Typology string passed to holistic scoring prompt (same as Aria context).';

CREATE INDEX IF NOT EXISTS idx_interview_attempts_scoring_deferred
  ON public.interview_attempts (scoring_deferred)
  WHERE scoring_deferred = true;
