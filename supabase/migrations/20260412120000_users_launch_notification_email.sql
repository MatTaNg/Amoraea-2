-- Optional email for launch / review notifications (PostInterview "Notify me").
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS launch_notification_email TEXT,
  ADD COLUMN IF NOT EXISTS launch_notification_submitted_at TIMESTAMPTZ;

COMMENT ON COLUMN users.launch_notification_email IS 'Email user provided to be notified at review / launch; optional, may differ from auth email.';
COMMENT ON COLUMN users.launch_notification_submitted_at IS 'When launch_notification_email was last submitted from the app.';
