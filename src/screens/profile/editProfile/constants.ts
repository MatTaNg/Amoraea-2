export function normalizePartnerPoliticalAlignmentToYesNo(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return '';
  if (/\b(no|not)\b/.test(s)) return 'No';
  if (/\byes\b|important|matters/.test(s)) return 'Yes';
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

export const PREF_PARTNER_SAME_RELIGION_OPTIONS: string[] = ['Yes', 'No'];

export const PREF_LONG_TERM_LOCATION_OPTIONS: string[] = [
  'Austin',
  'Major city other than Austin',
  'Smaller city',
  'Nature/rural',
  'Internationally',
  'Still figuring it out',
];

export const PREF_LIFESTYLE_OPTIONS: string[] = [
  'Stable/home-centered',
  'Balanced',
  'Travel-oriented',
  'Nomadic',
];

export const PREF_RELOCATION_OPTIONS: string[] = ['Yes', 'No'];
