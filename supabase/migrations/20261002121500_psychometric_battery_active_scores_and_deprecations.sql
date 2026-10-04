-- Active pre-interview battery columns and deprecations.
-- Idempotent with 20260819180000 and 20260930160000 so a database that never
-- applied those migrations still gains the split scores, entitlement placeholder,
-- and sexual-communication comfort columns.
-- Retired score columns are kept for historical rows and marked deprecated.
-- They are not dropped.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS psychometrics_battery_version text,
  ADD COLUMN IF NOT EXISTS psychometrics_amoraea_entitlement_v1_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_amoraea_entitlement_v1_scored_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_amoraea_entitlement_v1_score numeric,
  ADD COLUMN IF NOT EXISTS psychometrics_amoraea_entitlement_v1_version text,
  ADD COLUMN IF NOT EXISTS psychometrics_entitlement_score numeric,
  ADD COLUMN IF NOT EXISTS psychometrics_relationship_growth_beliefs_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_relationship_growth_beliefs_scored_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_relationship_growth_beliefs_score numeric,
  ADD COLUMN IF NOT EXISTS psychometrics_relationship_growth_beliefs_version text,
  ADD COLUMN IF NOT EXISTS psychometrics_conflict_catastrophizing_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_conflict_catastrophizing_scored_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_conflict_catastrophizing_score numeric,
  ADD COLUMN IF NOT EXISTS psychometrics_conflict_catastrophizing_version text,
  ADD COLUMN IF NOT EXISTS psychometrics_sexual_communication_comfort_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_sexual_communication_comfort_scored_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_sexual_communication_comfort_score numeric,
  ADD COLUMN IF NOT EXISTS psychometrics_sexual_communication_comfort_soft_modifier numeric,
  ADD COLUMN IF NOT EXISTS psychometrics_sexual_communication_comfort_version text,
  ADD COLUMN IF NOT EXISTS psychometrics_fully_completed boolean;

COMMENT ON COLUMN public.users.psychometrics_relationship_growth_beliefs_score IS
  'Mean of relationship_growth_beliefs items 1-6 (destiny/growth beliefs). Not psychometrics_dweck_score.';

COMMENT ON COLUMN public.users.psychometrics_conflict_catastrophizing_score IS
  'Mean of conflict_catastrophizing items 7-10. Not psychometrics_dweck_score.';

COMMENT ON COLUMN public.users.psychometrics_entitlement_score IS
  'Experimental Amoraea entitlement placeholder (not the licensed Psychological Entitlement Scale). Same mean as psychometrics_amoraea_entitlement_v1_score. Not a gate floor. Null until the instrument is completed.';

COMMENT ON COLUMN public.users.psychometrics_amoraea_entitlement_v1_score IS
  'Versioned copy of psychometrics_entitlement_score for amoraea_entitlement_v1. Experimental. Not a gate floor.';

COMMENT ON COLUMN public.users.psychometrics_sexual_communication_comfort_score IS
  'Mean of pre-interview sexual_communication_comfort (1-5). Not a copy of psychometrics_sexual_communication_score.';

COMMENT ON COLUMN public.users.psychometrics_fully_completed IS
  'True only when every instrument in the active pre-interview battery has a non-null score. Set in the same update as psychometrics_completed_at.';

COMMENT ON COLUMN public.users.psychometrics_dweck_score IS
  'DEPRECATED historical combined Dweck/RBI score. New users are scored on psychometrics_relationship_growth_beliefs_score and psychometrics_conflict_catastrophizing_score. Do not write new battery rows here.';

COMMENT ON COLUMN public.users.psychometrics_aaq2_score IS
  'DEPRECATED. AAQ-II was removed from the pre-interview battery. Null on new users is expected. Historical rows only.';

COMMENT ON COLUMN public.users.psychometrics_rfq_score IS
  'DEPRECATED. RFQ-8 was removed from the pre-interview battery. Null on new users is expected. Historical rows only.';

COMMENT ON COLUMN public.users.psychometrics_sexual_communication_score IS
  'DEPRECATED for new collection. Historical post-interview typology mean. The pre-interview battery writes psychometrics_sexual_communication_comfort_score.';
