-- Public aggregate for launch waitlist UI: how many users have passed the interview gate.
CREATE OR REPLACE FUNCTION public.get_launch_waitlist_passed_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT ia.user_id)::integer
  FROM interview_attempts ia
  WHERE ia.passed IS TRUE
    AND ia.completed_at IS NOT NULL
    AND (ia.is_phantom IS FALSE OR ia.is_phantom IS NULL);
$$;

REVOKE ALL ON FUNCTION public.get_launch_waitlist_passed_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_launch_waitlist_passed_count() TO authenticated;
