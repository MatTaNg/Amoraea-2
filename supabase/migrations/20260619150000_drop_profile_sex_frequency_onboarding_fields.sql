-- Remove legacy "How often do you want to have sex in a relationship?" (sexFrequencyPreference).
-- Natural rhythm is captured on `sexDrive` / profile_json keys from the other step.

update public.profiles
set profile_json = coalesce(profile_json, '{}'::jsonb) - 'sexFrequencyPreference' - 'sex_frequency_preference'
where profile_json ? 'sexFrequencyPreference'
   or profile_json ? 'sex_frequency_preference';

alter table public.profiles drop column if exists sex_frequency_preference;
alter table public.profiles drop column if exists "sexFrequencyPreference";

do $$
begin
  if to_regclass('public.onboarding_progress') is not null then
    update public.onboarding_progress
    set current_step = 'sexInterests'
    where current_step = 'sexFrequency';

    update public.onboarding_progress
    set onboarding_data = coalesce(onboarding_data, '{}'::jsonb) - 'sexFrequencyPreference'
    where onboarding_data ? 'sexFrequencyPreference';
  end if;
end $$;
