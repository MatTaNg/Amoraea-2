-- Relationship validation cohort (parallel to normal onboarding).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS validation_track TEXT,
  ADD COLUMN IF NOT EXISTS validation_interview_opted_in_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.validation_track IS
  'Cohort tag, e.g. relationship — routes user to validation flow instead of standard onboarding.';
COMMENT ON COLUMN public.users.validation_interview_opted_in_at IS
  'When a validation-track user opted into the full AI interview from the validation upsell.';

CREATE TABLE IF NOT EXISTS public.relationship_validation_records (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  partner_email_entered TEXT,
  partner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  pair_confirmed_at TIMESTAMPTZ,
  welcome_completed_at TIMESTAMPTZ,
  pre_assessment JSONB,
  post_assessment JSONB,
  psychometrics_completed_at TIMESTAMPTZ,
  compatibility_score NUMERIC,
  compatibility_breakdown JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS relationship_validation_records_partner_email_idx
  ON public.relationship_validation_records (lower(partner_email_entered));

CREATE INDEX IF NOT EXISTS relationship_validation_records_partner_user_id_idx
  ON public.relationship_validation_records (partner_user_id);

COMMENT ON TABLE public.relationship_validation_records IS
  'Per-user relationship validation study data: partner link, surveys, computed pair score.';

ALTER TABLE public.relationship_validation_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY relationship_validation_records_select_own
  ON public.relationship_validation_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY relationship_validation_records_insert_own
  ON public.relationship_validation_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY relationship_validation_records_update_own
  ON public.relationship_validation_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.relationship_validation_records TO authenticated;
GRANT ALL ON public.relationship_validation_records TO service_role;
