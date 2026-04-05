-- Link communication style profile to the interview attempt that produced it (optional FK).

do $$
begin
  if to_regclass('public.communication_style_profiles') is null then
    raise exception
      'Table communication_style_profiles does not exist. Run 20260401110000_add_communication_style_profiles.sql first.';
  end if;
end $$;

alter table communication_style_profiles
  add column if not exists source_attempt_id uuid references interview_attempts(id) on delete set null;

create index if not exists idx_communication_style_profiles_source_attempt
  on communication_style_profiles(source_attempt_id);
