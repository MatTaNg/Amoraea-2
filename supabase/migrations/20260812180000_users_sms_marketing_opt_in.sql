-- Optional SMS (match updates / account alerts). Not required for account creation.
-- Default false: unchecked signup must persist as no-consent.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sms_marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.sms_marketing_opt_in IS
  'TCPA/Twilio optional SMS: match updates and account alerts. Independent of account creation and OTP verification codes.';
