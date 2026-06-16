-- Cached AI-generated relationship validation profile report (PDF source markdown).

ALTER TABLE public.relationship_validation_records
  ADD COLUMN IF NOT EXISTS profile_report_markdown TEXT,
  ADD COLUMN IF NOT EXISTS profile_report_source_hash TEXT,
  ADD COLUMN IF NOT EXISTS profile_report_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.relationship_validation_records.profile_report_markdown IS
  'OpenAI-generated markdown for the validation cohort personal + compatibility report PDF.';
COMMENT ON COLUMN public.relationship_validation_records.profile_report_source_hash IS
  'Hash of psychometric + survey inputs; regenerate when inputs change.';
