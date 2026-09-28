-- Auth phone synced from Supabase Auth (E.164). Login identity; distinct from launch_notification_phone.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN users.phone IS 'Primary auth phone (E.164) copied from auth.users.phone when available.';
