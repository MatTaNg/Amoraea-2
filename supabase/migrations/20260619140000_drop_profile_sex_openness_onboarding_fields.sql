-- Remove "approach to sex" (sexual openness) — no longer collected in onboarding.

update public.profiles
set profile_json = coalesce(profile_json, '{}'::jsonb) - 'sexOpenness' - 'sex_openness'
where profile_json ? 'sexOpenness'
   or profile_json ? 'sex_openness';

alter table public.profiles drop column if exists sex_openness;
alter table public.profiles drop column if exists "sexOpenness";

do $$
begin
  if to_regclass('public.onboarding_progress') is not null then
    update public.onboarding_progress
    set current_step = 'sexInterests'
    where current_step = 'sexOpenness';

    update public.onboarding_progress
    set onboarding_data = coalesce(onboarding_data, '{}'::jsonb) - 'sexOpenness'
    where onboarding_data ? 'sexOpenness';
  end if;
end $$;
