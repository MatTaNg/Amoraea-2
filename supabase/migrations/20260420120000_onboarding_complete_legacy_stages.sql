-- The in-app flow after the interview (basic_info → psychometrics → compatibility) was removed.
-- Users left in intermediate stages are normalized to "complete" (interview track finished).
--
-- Idempotent: remotes may have skipped 20260218120000_onboarding_gates.sql / ensure_users_columns.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_stage TEXT DEFAULT 'interview';

UPDATE public.users
SET onboarding_stage = 'complete'
WHERE onboarding_stage IN ('basic_info', 'psychometrics', 'compatibility');

COMMENT ON COLUMN public.users.onboarding_stage IS
  'Current lifecycle: interview (default for new accounts) | complete. Legacy values basic_info, psychometrics, compatibility may still appear in old rows until backfilled.';
