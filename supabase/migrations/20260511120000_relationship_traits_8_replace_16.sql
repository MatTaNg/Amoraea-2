-- Replace legacy RELATIONSHIP_TRAITS_16 onboarding assessment with RELATIONSHIP_TRAITS_8 (same test_id: relationship_traits).
-- Removes stale user_assessments rows so completion checks use the new instrument id only.

DELETE FROM public.user_assessments
WHERE instrument = 'RELATIONSHIP_TRAITS_16';

-- Drop in-progress resume pointer if it still references the old instrument id.
UPDATE public.profiles
SET
  profile_json = coalesce(profile_json, '{}'::jsonb)
    - 'currentAssessment'
    - 'currentAssessmentQuestion',
  updated_at = timezone('utc', now())
WHERE profile_json->>'currentAssessment' = 'RELATIONSHIP_TRAITS_16';
