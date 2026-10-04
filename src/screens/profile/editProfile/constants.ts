import {
  PARTNER_ALIGNMENT_IMPORTANCE_OPTIONS,
  parsePartnerAlignmentImportance,
} from '@/shared/constants/partnerAlignmentImportance';

/** Normalize stored political-alignment importance to the 4-level slug (legacy Yes/No supported). */
export function normalizePartnerPoliticalAlignmentToYesNo(raw: string): string {
  return parsePartnerAlignmentImportance(raw) ?? '';
}

/** Partner already has children — options shown in onboarding MatchPreferencesModal. */
export const PREF_PARTNER_HAS_CHILDREN_OPTIONS: string[] = [
  'No preference',
  'Yes, Ok if they already have children',
  'Prefer partner without children',
];

/** Political alignment — onboarding / edit-profile 4-level importance. */
export const PREF_PARTNER_POLITICAL_SHARING_OPTIONS = PARTNER_ALIGNMENT_IMPORTANCE_OPTIONS;

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

export const PREF_PARTNER_SAME_RELIGION_OPTIONS = PARTNER_ALIGNMENT_IMPORTANCE_OPTIONS;

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

/** Partner height dynamic — onboarding AttractionPreferencesModal / edit profile. */
export const PREF_HEIGHT_DYNAMIC_OPTIONS: string[] = [
  'Much taller than me',
  'Slightly taller than me',
  'Around my height',
  'Shorter than me',
  'No strong preference',
];
