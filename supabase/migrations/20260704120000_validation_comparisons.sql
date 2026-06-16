-- Per-partner validation comparisons (psychometrics stay on relationship_validation_records).

CREATE TABLE IF NOT EXISTS public.relationship_validation_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  partner_email_entered TEXT NOT NULL,
  partner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  pair_confirmed_at TIMESTAMPTZ,
  pre_assessment JSONB,
  post_assessment JSONB,
  compatibility_score NUMERIC,
  compatibility_breakdown JSONB,
  profile_report_markdown TEXT,
  profile_report_source_hash TEXT,
  profile_report_generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS relationship_validation_comparisons_user_partner_email_idx
  ON public.relationship_validation_comparisons (user_id, lower(partner_email_entered));

CREATE INDEX IF NOT EXISTS relationship_validation_comparisons_user_id_idx
  ON public.relationship_validation_comparisons (user_id);

COMMENT ON TABLE public.relationship_validation_comparisons IS
  'One row per partner comparison in the relationship validation study. User-level psychometrics live on relationship_validation_records.';

ALTER TABLE public.relationship_validation_records
  ADD COLUMN IF NOT EXISTS active_comparison_id UUID REFERENCES public.relationship_validation_comparisons(id) ON DELETE SET NULL;

-- Migrate existing single-partner data into comparisons.
INSERT INTO public.relationship_validation_comparisons (
  user_id,
  partner_email_entered,
  partner_user_id,
  pair_confirmed_at,
  pre_assessment,
  post_assessment,
  compatibility_score,
  compatibility_breakdown,
  profile_report_markdown,
  profile_report_source_hash,
  profile_report_generated_at,
  created_at,
  updated_at
)
SELECT
  r.user_id,
  r.partner_email_entered,
  r.partner_user_id,
  r.pair_confirmed_at,
  r.pre_assessment,
  r.post_assessment,
  r.compatibility_score,
  r.compatibility_breakdown,
  r.profile_report_markdown,
  r.profile_report_source_hash,
  r.profile_report_generated_at,
  r.created_at,
  r.updated_at
FROM public.relationship_validation_records r
WHERE r.partner_email_entered IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.relationship_validation_comparisons c
    WHERE c.user_id = r.user_id
      AND lower(c.partner_email_entered) = lower(r.partner_email_entered)
  );

UPDATE public.relationship_validation_records r
SET active_comparison_id = c.id
FROM public.relationship_validation_comparisons c
WHERE c.user_id = r.user_id
  AND lower(c.partner_email_entered) = lower(r.partner_email_entered)
  AND r.partner_email_entered IS NOT NULL
  AND r.active_comparison_id IS NULL;

ALTER TABLE public.relationship_validation_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY relationship_validation_comparisons_select_own
  ON public.relationship_validation_comparisons
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY relationship_validation_comparisons_insert_own
  ON public.relationship_validation_comparisons
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY relationship_validation_comparisons_update_own
  ON public.relationship_validation_comparisons
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY relationship_validation_comparisons_select_admin
  ON public.relationship_validation_comparisons
  FOR SELECT
  TO authenticated
  USING (public.is_amoraea_admin());

GRANT SELECT, INSERT, UPDATE ON public.relationship_validation_comparisons TO authenticated;
GRANT ALL ON public.relationship_validation_comparisons TO service_role;
