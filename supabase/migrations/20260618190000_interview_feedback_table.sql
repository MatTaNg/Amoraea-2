-- User-submitted interview feedback; insert open for all roles; read for service role and Amoraea app admin.
create table public.interview_feedback (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  attempt_id      uuid references interview_attempts(id) on delete set null,
  user_id         uuid references auth.users(id) on delete set null,
  category        text,
  message         text not null,
  rating          smallint,
  page_context    text,
  user_agent      text
);

alter table public.interview_feedback enable row level security;

create policy "insert_feedback" on public.interview_feedback
  for insert with check (true);

create policy "admin_read_feedback" on public.interview_feedback
  for select using (auth.role() = 'service_role');

create policy "admin_read_feedback_app" on public.interview_feedback
  for select to authenticated
  using (public.is_amoraea_admin());
