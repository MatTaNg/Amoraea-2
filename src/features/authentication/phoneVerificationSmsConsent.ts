/** Express one-time SMS consent copy for Twilio / carrier verification (unchecked by default). */
export const PHONE_VERIFICATION_SMS_OPT_IN_LABEL =
  'I agree to receive a one-time text message from Amoraea to verify my phone number. Msg & data rates may apply.';

/** Keep in sync with supabase/config.toml [auth.sms] and [auth.mfa.phone] template. Hosted Dashboard must match. */
export const AUTH_SMS_OTP_MESSAGE_TEMPLATE = 'Your Amoraea verification code is: {{ .Code }}';
