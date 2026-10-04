import {
  AUTH_SMS_OTP_MESSAGE_TEMPLATE,
  PHONE_VERIFICATION_SMS_OPT_IN_LABEL,
} from '../phoneVerificationSmsConsent';

describe('phoneVerificationSmsConsent', () => {
  it('uses the Twilio-required one-time verification consent label', () => {
    expect(PHONE_VERIFICATION_SMS_OPT_IN_LABEL).toBe(
      'I agree to receive a one-time text message from Amoraea to verify my phone number. Msg & data rates may apply.',
    );
  });

  it('names Amoraea in the OTP SMS template', () => {
    expect(AUTH_SMS_OTP_MESSAGE_TEMPLATE).toBe('Your Amoraea verification code is: {{ .Code }}');
  });
});
