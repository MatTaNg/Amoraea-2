import {
  parseSmsMarketingOptIn,
  readSmsMarketingOptInFromMetadata,
  SMS_MARKETING_OPT_IN_LABEL,
} from '../smsMarketingOptIn';

describe('smsMarketingOptIn', () => {
  it('treats only explicit true as opt-in', () => {
    expect(parseSmsMarketingOptIn(true)).toBe(true);
    expect(parseSmsMarketingOptIn(false)).toBe(false);
    expect(parseSmsMarketingOptIn(undefined)).toBe(false);
    expect(parseSmsMarketingOptIn(null)).toBe(false);
    expect(parseSmsMarketingOptIn('true')).toBe(false);
    expect(parseSmsMarketingOptIn(1)).toBe(false);
  });

  it('reads metadata without implying consent', () => {
    expect(readSmsMarketingOptInFromMetadata(undefined)).toBe(false);
    expect(readSmsMarketingOptInFromMetadata({})).toBe(false);
    expect(readSmsMarketingOptInFromMetadata({ sms_marketing_opt_in: false })).toBe(false);
    expect(readSmsMarketingOptInFromMetadata({ sms_marketing_opt_in: true })).toBe(true);
  });

  it('uses Twilio-style optional SMS consent copy', () => {
    expect(SMS_MARKETING_OPT_IN_LABEL).toBe(
      'I agree to be texted match alerts and account updates. Msg & data rates may apply. Reply STOP to opt out.',
    );
  });
});
