-- Let existing standard-app users opt into the RELATIONSHIP validation cohort
-- without replacing their post-interview shell on login.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS validation_standard_app_enrolled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS validation_flow_active BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.validation_standard_app_enrolled IS
  'True when an existing standard-app user was enrolled in the RELATIONSHIP validation cohort (admin); they stay on post-interview until they opt in.';
COMMENT ON COLUMN public.users.validation_flow_active IS
  'True while a validation_standard_app_enrolled user is actively in the relationship validation navigator.';
