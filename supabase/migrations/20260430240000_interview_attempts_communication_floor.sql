-- Admin-only communication style floor flag (avg unprompted word count < 20). Does not affect pass/fail.

ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS communication_floor_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS communication_floor_avg_unprompted_words double precision,
  ADD COLUMN IF NOT EXISTS communication_floor_dismissed_at timestamptz,
  ADD COLUMN IF NOT EXISTS communication_floor_dismissed_by uuid,
  ADD COLUMN IF NOT EXISTS communication_floor_dismiss_note text;

COMMENT ON COLUMN public.interview_attempts.communication_floor_flag IS
  'True when average unprompted user word count (scenarios A–C + moments 4–5) is below 20; informational for admin only.';
COMMENT ON COLUMN public.interview_attempts.communication_floor_avg_unprompted_words IS
  'Average word count of included unprompted user turns used for the communication floor check.';
COMMENT ON COLUMN public.interview_attempts.communication_floor_dismissed_at IS
  'When set, the active review badge is cleared in the admin console (Matt reviewed).';
COMMENT ON COLUMN public.interview_attempts.communication_floor_dismissed_by IS
  'auth.users id of the admin who dismissed the communication floor flag.';
COMMENT ON COLUMN public.interview_attempts.communication_floor_dismiss_note IS
  'Admin note explaining why the communication floor flag was dismissed.';

CREATE OR REPLACE FUNCTION public.interview_attempts_guard_communication_floor_dismiss()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  -- Service role / Edge: no JWT subject
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.is_amoraea_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.communication_floor_dismissed_at IS DISTINCT FROM OLD.communication_floor_dismissed_at
     OR NEW.communication_floor_dismissed_by IS DISTINCT FROM OLD.communication_floor_dismissed_by
     OR NEW.communication_floor_dismiss_note IS DISTINCT FROM OLD.communication_floor_dismiss_note THEN
    RAISE EXCEPTION 'communication floor dismiss fields may only be changed by an Amoraea admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS interview_attempts_guard_communication_floor_dismiss ON public.interview_attempts;
CREATE TRIGGER interview_attempts_guard_communication_floor_dismiss
  BEFORE UPDATE ON public.interview_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.interview_attempts_guard_communication_floor_dismiss();

COMMENT ON FUNCTION public.interview_attempts_guard_communication_floor_dismiss() IS
  'Blocks non-admin updates to communication_floor_dismissed_at / _by / _dismiss_note.';
