-- Remove legacy sex drive / natural rhythm answers from profile storage.
-- Canonical dating fields live in `profiles.profile_json`; some templates also mirrored keys as top-level columns.

update public.profiles
set profile_json = coalesce(profile_json, '{}'::jsonb) - 'sexDrive' - 'sex_drive'
where profile_json ? 'sexDrive'
   or profile_json ? 'sex_drive';

alter table public.profiles drop column if exists sex_drive;
alter table public.profiles drop column if exists "sexDrive";

-- If onboarding_progress exists, remap saved step and drop stale answers
do $$
begin
  if to_regclass('public.onboarding_progress') is not null then
    update public.onboarding_progress
    set current_step = 'sexInterests'
    where current_step = 'sexDrive';

    update public.onboarding_progress
    set onboarding_data = coalesce(onboarding_data, '{}'::jsonb) - 'sexDrive'
    where onboarding_data ? 'sexDrive';
  end if;
end $$;
