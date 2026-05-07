-- Interview did not yield a completable scoring payload (missing scenario slice or Moment 4).
ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS incomplete_reason text;

COMMENT ON COLUMN public.interview_attempts.incomplete_reason IS
  'When set, weighted scoring and pass were skipped — e.g. missing_scenario_1, missing_moment_4';
