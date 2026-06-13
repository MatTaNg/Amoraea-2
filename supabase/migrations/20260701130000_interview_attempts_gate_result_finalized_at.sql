-- Gate result (psychometric modifier + final pass/fail) finalized after psychometrics battery.
ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS gate_result_finalized_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.interview_attempts.gate_result_finalized_at IS
  'When psychometric gate finalization (modifier, final_gate_pass, floor codes) was persisted after psychometrics_completed_at.';
