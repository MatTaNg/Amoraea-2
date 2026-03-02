-- Reset admin@amoraea.com so they can retake the AI interview (Stage 1).
-- Sets onboarding_stage to 'interview', clears gate1_score, sets application_status to 'pending'.

UPDATE users
SET
  onboarding_stage = 'interview',
  gate1_score = NULL,
  application_status = 'pending'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'admin@amoraea.com'
);
