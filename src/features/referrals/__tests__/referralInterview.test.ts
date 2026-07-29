import {
  REFERRAL_BASE_DISCOUNT,
  REFERRAL_SIGNUP_BONUS_DISCOUNT,
  resolveProspectiveCompletionDiscount,
} from '@features/referrals/referralInterview';

describe('resolveProspectiveCompletionDiscount', () => {
  it('returns 40% for users who signed up without a referral code', () => {
    expect(resolveProspectiveCompletionDiscount(false)).toBe(REFERRAL_BASE_DISCOUNT);
  });

  it('returns 60% for users who signed up with a valid referral code', () => {
    expect(resolveProspectiveCompletionDiscount(true)).toBe(
      REFERRAL_BASE_DISCOUNT + REFERRAL_SIGNUP_BONUS_DISCOUNT,
    );
  });
});
