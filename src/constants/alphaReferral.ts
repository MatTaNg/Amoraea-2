/** Canonical alpha tester referral (case-insensitive for user input). */
export const ALPHA_TESTER_REFERRAL_CODE = 'MTRX-7K2P';

export function normalizeReferralCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

export function isAlphaTesterReferralCode(input: string): boolean {
  if (!input?.trim()) return false;
  return normalizeReferralCode(input) === normalizeReferralCode(ALPHA_TESTER_REFERRAL_CODE);
}
