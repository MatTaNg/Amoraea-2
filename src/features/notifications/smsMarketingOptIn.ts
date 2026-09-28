/** User-facing TCPA / Twilio toll-free verification copy for optional SMS. */
export const SMS_MARKETING_OPT_IN_LABEL =
  'I agree to be texted me match updates and account alerts. Msg & data rates may apply. Message frequency varies. Reply STOP to opt out, HELP for help.';

export const SMS_MARKETING_OPT_IN_METADATA_KEY = 'sms_marketing_opt_in';

export function parseSmsMarketingOptIn(value: unknown): boolean {
  return value === true;
}

export type AuthSignupMetadata = {
  referral_code?: string;
  age?: number;
  gender?: string;
  sms_marketing_opt_in?: boolean;
};

export function readSmsMarketingOptInFromMetadata(
  metadata: AuthSignupMetadata | null | undefined,
): boolean {
  return parseSmsMarketingOptIn(metadata?.sms_marketing_opt_in);
}
