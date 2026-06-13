-- Persist Claude-generated personal report markdown on the attempt (avoid re-generation on each visit).
ALTER TABLE public.interview_attempts
  ADD COLUMN IF NOT EXISTS partial_report_markdown text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS partial_report_source_hash text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS partial_report_generated_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS personal_report_markdown text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS personal_report_source_hash text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS personal_report_generated_at timestamptz DEFAULT NULL;

COMMENT ON COLUMN public.interview_attempts.partial_report_markdown IS
  'Cached markdown for the post-interview partial personal report (interview-only).';
COMMENT ON COLUMN public.interview_attempts.personal_report_markdown IS
  'Cached markdown for the full personal development report (interview + psychometrics). Overrides partial when present.';
