-- Post-completion interview feedback (after AI interview + psychometrics).
-- Bubble feedback keeps using interview_feedback.message; this form also stores a structured jsonb payload.
-- Closing or skipping the form does not set users.post_completion_feedback_submitted_at.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS post_completion_feedback_submitted_at timestamptz;

COMMENT ON COLUMN public.users.post_completion_feedback_submitted_at IS
  'Set only when the user explicitly submits post-completion interview feedback. Skip/close does not set this.';

ALTER TABLE public.interview_feedback
  ADD COLUMN IF NOT EXISTS response jsonb;

COMMENT ON COLUMN public.interview_feedback.response IS
  'Structured post_completion_v1 payload. Null for freeform feedback-bubble rows.';
