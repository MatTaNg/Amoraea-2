-- Post-interview 48h processing hold: admin may set override_status on the attempt before reveal.
-- Non-admin users cannot change override columns (RLS still allows own row updates for other fields).

ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS override_status boolean,
  ADD COLUMN IF NOT EXISTS override_set_at timestamptz;

COMMENT ON COLUMN public.interview_attempts.override_status IS
  'When set before the 48h processing window ends, routing uses this instead of `passed` for the applicant.';
COMMENT ON COLUMN public.interview_attempts.override_set_at IS
  'Timestamp when `override_status` was written (admin early reveal).';

-- Best-effort: enable realtime for client subscriptions on attempt updates (no-op if already added).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_attempts;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.interview_attempts_guard_override_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF public.is_amoraea_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.override_status IS DISTINCT FROM OLD.override_status
     OR NEW.override_set_at IS DISTINCT FROM OLD.override_set_at THEN
    RAISE EXCEPTION 'override fields may only be changed by an Amoraea admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS interview_attempts_guard_override_columns ON public.interview_attempts;
CREATE TRIGGER interview_attempts_guard_override_columns
  BEFORE UPDATE ON public.interview_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.interview_attempts_guard_override_columns();

COMMENT ON FUNCTION public.interview_attempts_guard_override_columns() IS
  'Blocks non-admin updates to override_status / override_set_at on interview_attempts.';

-- Align admin UPDATE with is_amoraea_admin() (JWT email checks are brittle).
DROP POLICY IF EXISTS "interview_attempts_authenticated_update_admin" ON public.interview_attempts;
CREATE POLICY "interview_attempts_authenticated_update_admin"
  ON public.interview_attempts FOR UPDATE TO authenticated
  USING (public.is_amoraea_admin())
  WITH CHECK (public.is_amoraea_admin());
