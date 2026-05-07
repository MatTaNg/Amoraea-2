export function normalizePartnerPoliticalAlignmentToYesNo(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return '';
  if (/yes|important/.test(s)) return 'Yes';
  if (/no|not/.test(s)) return 'No';
  return raw.trim();
}

/** Partner already has children — options shown in onboarding MatchPreferencesModal. */
export const PREF_PARTNER_HAS_CHILDREN_OPTIONS: string[] = [
  'No preference',
  'Yes — OK if they already have children',
  'Prefer partner without children',
];

/** Political alignment — onboarding BottomSheet string options. */
export const PREF_PARTNER_POLITICAL_SHARING_OPTIONS: string[] = [
  'Yes — matters a lot',
  'Somewhat important',
  'No — not important',
];

export const PREF_DEALBREAKER_CHILDREN_OPTIONS: string[] = [
  "Don't want kids",
  'Undecided',
  'Want kids',
];

export const PREF_DEALBREAKER_POLITICS_OPTIONS: string[] = [
  'No preference',
  'Apolitical',
  'Moderate',
  'Progressive',
  'Conservative',
  'Other',
];

export const PREF_DEALBREAKER_RELIGION_OPTIONS: string[] = [
  'No preference',
  'Spiritual',
  'Christian',
  'Jewish',
  'Muslim',
  'Hindu',
  'Agnostic',
  'Atheist',
  'Other',
];
