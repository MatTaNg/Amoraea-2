-- Romantic vs platonic branching for RELATIONSHIP-code validation psychometrics.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'relationship_validation_test_mode') THEN
    CREATE TYPE public.relationship_validation_test_mode AS ENUM ('romantic', 'platonic');
  END IF;
END $$;

ALTER TABLE public.relationship_validation_records
  ADD COLUMN IF NOT EXISTS relationship_test_mode public.relationship_validation_test_mode DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS romantic_test_relationship_duration TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platonic_test_past_relationship_ended TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS platonic_test_past_relationship_duration TEXT DEFAULT NULL;

COMMENT ON COLUMN public.relationship_validation_records.relationship_test_mode IS
  'Whether the validation comparison partner is a romantic partner or a platonic test friend. NULL for legacy rows.';
COMMENT ON COLUMN public.relationship_validation_records.romantic_test_relationship_duration IS
  'Duration bucket for current romantic relationship (branching screen); distinct from pre_assessment.duration on comparisons.';
COMMENT ON COLUMN public.relationship_validation_records.platonic_test_past_relationship_ended IS
  'When the past romantic relationship ended (platonic test mode reference frame).';
COMMENT ON COLUMN public.relationship_validation_records.platonic_test_past_relationship_duration IS
  'How long the past romantic relationship lasted (platonic test mode reference frame).';
