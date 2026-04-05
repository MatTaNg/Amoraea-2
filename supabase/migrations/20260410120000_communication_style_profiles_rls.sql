-- Allow authenticated users to read their own profile; allow admin@amoraea.com to read all (admin dashboard).
-- Edge functions use the service role and bypass RLS.

alter table communication_style_profiles enable row level security;

drop policy if exists "communication_style_profiles_select_own_or_admin" on communication_style_profiles;

create policy "communication_style_profiles_select_own_or_admin"
  on communication_style_profiles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or lower(trim(coalesce((select auth.jwt() ->> 'email'), ''))) = 'admin@amoraea.com'
  );
