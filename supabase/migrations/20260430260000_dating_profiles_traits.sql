-- Dating onboarding bundle: flexible profile JSON + trait scores JSON.
-- Safe if your other app already created richer tables — adjust repos or merge migrations as needed.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  profile_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_traits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  scores jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;
alter table public.user_traits enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "user_traits_select_own" on public.user_traits;
create policy "user_traits_select_own"
  on public.user_traits for select
  using (auth.uid() = user_id);

drop policy if exists "user_traits_upsert_own" on public.user_traits;
create policy "user_traits_upsert_own"
  on public.user_traits for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_traits_update_own" on public.user_traits;
create policy "user_traits_update_own"
  on public.user_traits for update
  using (auth.uid() = user_id);
