-- Align launch waitlist counter with admin cohort pass stats (user-level effective pass).
-- Previously counted DISTINCT interview_attempts.passed, which missed admin overrides,
-- users.interview_passed routing, and stale attempt rows after psychometric re-gating.

CREATE OR REPLACE FUNCTION public.get_launch_waitlist_passed_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cohort AS (
    SELECT
      u.id,
      u.interview_passed,
      u.interview_passed_computed,
      u.interview_passed_admin_override
    FROM users u
    WHERE u.interview_completed IS TRUE
      AND lower(coalesce(u.email, '')) NOT LIKE '%@seed.amoraea.test'
      AND NOT EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = u.id
          AND p.profile_json->'compatibilityTestSeed'->>'tag' = 'compat-algo-v2'
      )
  ),
  latest_attempt AS (
    SELECT DISTINCT ON (ia.user_id)
      ia.user_id,
      ia.passed,
      ia.override_status
    FROM interview_attempts ia
    INNER JOIN cohort c ON c.id = ia.user_id
    WHERE ia.is_phantom IS FALSE OR ia.is_phantom IS NULL
    ORDER BY ia.user_id, COALESCE(ia.completed_at, ia.created_at) DESC NULLS LAST, ia.id DESC
  )
  SELECT COUNT(*)::integer
  FROM cohort c
  LEFT JOIN latest_attempt la ON la.user_id = c.id
  WHERE CASE
    WHEN la.override_status IS TRUE THEN TRUE
    WHEN la.override_status IS FALSE THEN FALSE
    WHEN c.interview_passed_admin_override IS TRUE THEN TRUE
    WHEN c.interview_passed_admin_override IS FALSE THEN FALSE
    WHEN c.interview_passed IS NOT NULL
      AND c.interview_passed_computed IS NOT NULL
      AND c.interview_passed IS DISTINCT FROM c.interview_passed_computed
      THEN c.interview_passed
    WHEN c.interview_passed IS TRUE THEN TRUE
    WHEN c.interview_passed IS NULL AND la.passed IS TRUE THEN TRUE
    ELSE FALSE
  END;
$$;

REVOKE ALL ON FUNCTION public.get_launch_waitlist_passed_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_launch_waitlist_passed_count() TO authenticated;
