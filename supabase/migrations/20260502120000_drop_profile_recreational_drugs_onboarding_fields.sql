-- Remove legacy "Recreational drugs" onboarding answers (ABOUT_DRUGS → cannabis / lifestyle_drugs).
-- Substance preferences are captured via relationship_with_psychedelics, relationship_with_cannabis, etc.

-- profile_json is the canonical merge target for dating fields (see profilesRepo.updateProfile).
update public.profiles
set profile_json = coalesce(profile_json, '{}'::jsonb) - 'cannabis' - 'lifestyle_drugs'
where profile_json ? 'cannabis'
   or profile_json ? 'lifestyle_drugs';

-- Optional top-level columns on stricter / older templates
alter table public.profiles drop column if exists cannabis;
alter table public.profiles drop column if exists lifestyle_drugs;

-- If onboarding_progress exists, remap saved step and drop stale answers
do $$
begin
  if to_regclass('public.onboarding_progress') is not null then
    update public.onboarding_progress
    set current_step = 'haveKids'
    where current_step = 'drugs';

    update public.onboarding_progress
    set onboarding_data = coalesce(onboarding_data, '{}'::jsonb) - 'drugs'
    where onboarding_data ? 'drugs';
  end if;
end $$;
