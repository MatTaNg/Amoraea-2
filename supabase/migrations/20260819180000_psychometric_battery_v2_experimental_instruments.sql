-- Versioned experimental psychometric instruments (historical AAQ-II / RFQ / NPI / Dweck columns retained).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS psychometrics_battery_version text,
  ADD COLUMN IF NOT EXISTS psychometrics_amoraea_entitlement_v1_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_amoraea_entitlement_v1_scored_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_amoraea_entitlement_v1_score numeric,
  ADD COLUMN IF NOT EXISTS psychometrics_amoraea_entitlement_v1_version text,
  ADD COLUMN IF NOT EXISTS psychometrics_relationship_growth_beliefs_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_relationship_growth_beliefs_scored_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_relationship_growth_beliefs_score numeric,
  ADD COLUMN IF NOT EXISTS psychometrics_relationship_growth_beliefs_version text,
  ADD COLUMN IF NOT EXISTS psychometrics_conflict_catastrophizing_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_conflict_catastrophizing_scored_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_conflict_catastrophizing_score numeric,
  ADD COLUMN IF NOT EXISTS psychometrics_conflict_catastrophizing_version text;

COMMENT ON COLUMN public.users.psychometrics_battery_version IS
  'Active pre-interview battery version that produced current experimental instrument scores.';
