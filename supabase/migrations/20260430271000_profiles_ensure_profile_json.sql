-- If `public.profiles` already existed (another template/app) before
-- 20260430260000_dating_profiles_traits.sql, `create table if not exists` did nothing and
-- `profile_json` was never created. Client upserts then fail with PostgREST PGRST204.

do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      add column if not exists profile_json jsonb not null default '{}'::jsonb;
  end if;
end $$;
