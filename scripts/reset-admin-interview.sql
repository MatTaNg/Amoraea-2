-- Reset interview data for admin@amoraea.com
-- Run this in Supabase Dashboard > SQL Editor (runs as postgres; can read auth.users).

-- 1. Reset users table interview columns for admin
UPDATE public.users
SET
  interview_completed = false,
  interview_passed = null,
  interview_weighted_score = null,
  interview_completed_at = null,
  interview_last_checkpoint = 0,
  interview_attempt_count = 0,
  latest_attempt_id = null
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@amoraea.com' LIMIT 1
);

-- 2. (Optional) Delete all interview_attempts for admin so they start completely fresh
DELETE FROM public.interview_attempts
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'admin@amoraea.com' LIMIT 1
);

-- If you prefer to reset by user id (e.g. if auth.users isn't accessible), replace the subquery with the actual uuid:
-- WHERE id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
