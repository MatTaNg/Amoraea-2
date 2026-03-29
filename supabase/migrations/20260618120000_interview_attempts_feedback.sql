-- Add feedback columns for post-interview user feedback flow.
ALTER TABLE interview_attempts
  ADD COLUMN IF NOT EXISTS feedback_accuracy int,
  ADD COLUMN IF NOT EXISTS feedback_human int,
  ADD COLUMN IF NOT EXISTS feedback_safety int,
  ADD COLUMN IF NOT EXISTS feedback_experience int,
  ADD COLUMN IF NOT EXISTS feedback_fairness int,
  ADD COLUMN IF NOT EXISTS feedback_surprise int,
  ADD COLUMN IF NOT EXISTS feedback_comments jsonb,
  ADD COLUMN IF NOT EXISTS feedback_submitted_at timestamptz;
