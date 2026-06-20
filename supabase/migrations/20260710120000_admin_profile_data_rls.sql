-- Admin dashboard: read dating profile, photos, assessments, and onboarding answers for any user.
-- Uses public.is_amoraea_admin() (auth.users email), same as interview_attempts admin policies.

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles',
    'profile_photos',
    'user_assessments',
    'user_traits',
    'life_domain_answers',
    'onboarding_progress'
  ]
  LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS admin_select_%I ON public.%I',
        tbl,
        tbl
      );
      EXECUTE format(
        'CREATE POLICY admin_select_%I ON public.%I FOR SELECT TO authenticated USING (public.is_amoraea_admin())',
        tbl,
        tbl
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON POLICY admin_select_profiles ON public.profiles IS
  'Amoraea admin console can read any user dating profile row for support and review.';
