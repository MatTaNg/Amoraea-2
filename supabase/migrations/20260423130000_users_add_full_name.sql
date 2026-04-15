-- PostgREST returns 400 if a select lists a missing column. Some clients request `full_name`
-- (e.g. admin user list). Core schema used `name` / `display_name`; add optional `full_name`
-- for parity with auth user_metadata and explicit selects.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS full_name TEXT;

COMMENT ON COLUMN public.users.full_name IS 'Optional full name; may mirror auth user_metadata.full_name.';
