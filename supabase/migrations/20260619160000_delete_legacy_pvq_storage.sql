-- Remove all stored PVQ-21 / values assessment payloads (legacy 21-item and any pre-TwIVI rows).
-- Instrument id stays PVQ-21; TwIVI uses 20 items + MRAT-centered scores + raw_* domain means.
-- Intended when no production users depend on existing rows.

DO $purge$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_assessments'
  ) THEN
    DELETE FROM public.user_assessments WHERE instrument = 'PVQ-21';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'test_results'
  ) THEN
    DELETE FROM public.test_results WHERE test_id = 'values';
  END IF;
END
$purge$;

-- Stage 3 gate snapshot + resume progress (legacy users table)
UPDATE public.users
SET gate2_psychometrics = gate2_psychometrics - 'pvq21'
WHERE gate2_psychometrics IS NOT NULL
  AND gate2_psychometrics ? 'pvq21';

UPDATE public.users
SET psychometrics_progress = psychometrics_progress - 'pvq'
WHERE psychometrics_progress IS NOT NULL
  AND psychometrics_progress ? 'pvq';

-- Standalone Schwartz typology rows
DELETE FROM public.typologies WHERE typology_type = 'schwartz_values';

-- Full-assessment blob (ECR + TIPI + … + pvq answer maps)
UPDATE public.typologies
SET typology_data = typology_data - 'pvq'
WHERE typology_type = 'full_assessment'
  AND typology_data ? 'pvq';

COMMENT ON COLUMN public.users.gate2_psychometrics IS 'ECR-12, TIPI, DSI-SF, BRS, PVQ-21 (TwIVI 20-item; MRAT-centered domains + raw_* means in JSON when present)';
