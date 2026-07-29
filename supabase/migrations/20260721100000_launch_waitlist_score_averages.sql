-- Aggregate final modified scores for launch waitlist congrats UI (authenticated clients).
CREATE OR REPLACE FUNCTION public.get_launch_waitlist_score_averages()
RETURNS TABLE (
  cohort_average_final_score numeric,
  scored_user_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest AS (
    SELECT DISTINCT ON (ia.user_id)
      ia.user_id,
      COALESCE(
        ia.modified_weighted_score_with_psychometrics,
        ia.modified_weighted_score,
        ia.weighted_score
      ) AS final_score
    FROM interview_attempts ia
    WHERE ia.completed_at IS NOT NULL
      AND (ia.is_phantom IS FALSE OR ia.is_phantom IS NULL)
      AND COALESCE(
        ia.modified_weighted_score_with_psychometrics,
        ia.modified_weighted_score,
        ia.weighted_score
      ) IS NOT NULL
    ORDER BY ia.user_id, ia.completed_at DESC NULLS LAST, ia.id DESC
  )
  SELECT
    ROUND(AVG(final_score)::numeric, 2) AS cohort_average_final_score,
    COUNT(*)::integer AS scored_user_count
  FROM latest;
$$;

REVOKE ALL ON FUNCTION public.get_launch_waitlist_score_averages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_launch_waitlist_score_averages() TO authenticated;
