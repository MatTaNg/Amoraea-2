-- Admin dashboard (AdminInterviewDashboard) lists all registered users. RLS on `users` only allowed
-- SELECT for own row (20260209000003), so admin@amoraea.com could not see other accounts (e.g. after
-- a test user completed an interview). Mirror the JWT email check used in
-- 20260410120000_communication_style_profiles_rls.sql.

drop policy if exists "Admin email can select all users" on public.users;

create policy "Admin email can select all users"
  on public.users
  for select
  to authenticated
  using (
    lower(trim(coalesce((select auth.jwt() ->> 'email'), ''))) = 'admin@amoraea.com'
  );
