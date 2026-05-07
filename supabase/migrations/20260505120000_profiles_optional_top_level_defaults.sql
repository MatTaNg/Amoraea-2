-- Optional top-level columns on `profiles` (common on strict / Supabase-style templates).
-- Safe with minimal dating schema: only adds missing columns; defaults help bare INSERTs.

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists website text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists display_name text;

alter table public.profiles alter column avatar_url set default '';
alter table public.profiles alter column full_name set default '';
alter table public.profiles alter column website set default '';
