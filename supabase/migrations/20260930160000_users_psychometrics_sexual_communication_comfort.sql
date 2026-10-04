-- Pre-interview sexual communication comfort (amoraea_scc_v1 / battery pre_interview_v3).
-- Historical post-interview typology scores stay in psychometrics_sexual_communication_*
-- and are not copied or reinterpreted here.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS psychometrics_sexual_communication_comfort_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_sexual_communication_comfort_scored_responses jsonb,
  ADD COLUMN IF NOT EXISTS psychometrics_sexual_communication_comfort_score numeric,
  ADD COLUMN IF NOT EXISTS psychometrics_sexual_communication_comfort_soft_modifier numeric,
  ADD COLUMN IF NOT EXISTS psychometrics_sexual_communication_comfort_version text;

COMMENT ON COLUMN public.users.psychometrics_sexual_communication_comfort_score IS
  'Mean of pre-interview sexual_communication_comfort (1–5). Not a copy of psychometrics_sexual_communication_score.';

COMMENT ON COLUMN public.users.psychometrics_sexual_communication_comfort_soft_modifier IS
  'Persisted sexual_communication_soft_modifier at assessment time (0 or 0.05). Uncertainty input only. Not a gate floor.';

COMMENT ON COLUMN public.users.psychometrics_sexual_communication_score IS
  'Historical post-interview typology mean (post_interview_typology_sexual_communication_v1). Not the pre-interview instrument.';
