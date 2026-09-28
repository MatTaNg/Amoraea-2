-- Remove dating pace after excitement question from profile storage and onboarding resume.

update public.profiles
set profile_json = coalesce(profile_json, '{}'::jsonb)
  - 'datingPaceAfterExcitement'
  - 'dating_pace_after_excitement'
where profile_json ? 'datingPaceAfterExcitement'
   or profile_json ? 'dating_pace_after_excitement';

alter table public.profiles drop column if exists dating_pace_after_excitement;
alter table public.profiles drop column if exists "datingPaceAfterExcitement";

do $$
begin
  if to_regclass('public.onboarding_progress') is not null then
    update public.onboarding_progress
    set current_step = 'recentDatingEarlyWeeks'
    where current_step = 'datingPaceAfterExcitement';

    update public.onboarding_progress
    set onboarding_data = coalesce(onboarding_data, '{}'::jsonb) - 'datingPaceAfterExcitement'
    where onboarding_data ? 'datingPaceAfterExcitement';
  end if;
end $$;
