-- Optional SMS number for launch / review notifications (PostInterview); email remains on auth account.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS launch_notification_phone TEXT;

COMMENT ON COLUMN users.launch_notification_phone IS 'Optional mobile number for SMS updates; login email used for email notifications.';
