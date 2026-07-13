export const REFERRAL_CODE_INTRO_POPUP_SEEN_KEY = '@amoraea:referral_code_intro_popup_seen';

export function referralCodeIntroSeenStorageKey(userId: string): string {
  return `${REFERRAL_CODE_INTRO_POPUP_SEEN_KEY}:${userId}`;
}
