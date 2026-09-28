export const SEX_DRIVE_OPTIONS = [
  { label: 'Daily, or almost daily', value: 'Daily, or almost daily' },
  { label: '3-5x a week', value: '3-5x a week' },
  { label: '1-2x a week', value: '1-2x a week' },
  { label: 'A few times a month', value: 'A few times a month' },
];

export const RECENT_DATING_EARLY_WEEKS_QUESTION =
  'Think about your most recent dating experience. In the first 2–3 weeks, how often did you see each other?';

export const RECENT_DATING_EARLY_WEEKS_OPTIONS = [
  'We saw each other occasionally and took it slow',
  'We saw each other 1–2 times a week',
  'We spent a lot of time together quickly',
  'We got emotionally or physically involved very fast',
].map((label) => ({ label, value: label }));

/** Realistic bandwidth for starting something new (onboarding + edit profile). */
export const SPACE_FOR_NEW_RELATIONSHIP_OPTIONS = [
  "Very little, I'm busy but open",
  'Some, I can date slowly',
  'Moderate, I can make consistent time',
  "A lot, I'm ready to prioritize a relationship",
].map((label) => ({ label, value: label }));

export const PARTNER_MOOD_MISMATCH_RESPONSE_OPTIONS = [
  'Make an effort because their experience matters to me',
  "Engage sometimes, depending on how I'm feeling",
  "Usually pass — I'd rather wait until we're both feeling it",
  "Prefer to be honest that it's not the right time",
].map((label) => ({ label, value: label }));

export const SEXUAL_FOCUS_OPTIONS = [
  'Making sure my partner feels good',
  'Our shared experience equally',
  'My own experience',
  'It shifts depending on the moment',
].map((label) => ({ label, value: label }));

export const PREF_PHYSICAL_COMPAT_CENTRALITY_OPTIONS = [
  'Not important',
  'A little important',
  'Moderately important',
  'Very important',
  "Can't imagine a relationship without it",
] as const;

export const PREF_PARTNER_SHARES_SEXUAL_INTERESTS_OPTIONS = [
  'No preference',
  'Not important',
  'Somewhat important',
  'Important',
  'Dealbreaker',
] as const;

import {
  PARTNER_SPECIFIC_SEX_INTERESTS_DEALBREAKER_QUESTION,
} from '@/shared/constants/dealbreakerQuestionCopy';
import {
  PARTNER_ALIGNMENT_IMPORTANCE_OPTIONS,
  parsePartnerAlignmentImportance,
  partnerAlignmentImportanceLabel,
  partnerAlignmentImportancePickerValue,
} from '@/shared/constants/partnerAlignmentImportance';

/** Shown in onboarding + edit profile dealbreakers. */
export const PREF_PARTNER_SHARES_SPECIFIC_SEX_INTERESTS_QUESTION =
  PARTNER_SPECIFIC_SEX_INTERESTS_DEALBREAKER_QUESTION;

/** Bottom sheet title when picking importance for {@link PREF_PARTNER_SHARES_SPECIFIC_SEX_INTERESTS_QUESTION}. */
export const PREF_PARTNER_SPECIFIC_SEX_INTERESTS_SHEET_TITLE =
  'Specific sex interests — how much of a dealbreaker?';

/** 4-level importance rows for {@link PREF_PARTNER_SHARES_SPECIFIC_SEX_INTERESTS_QUESTION}. */
export const PARTNER_SPECIFIC_SEX_MUST_HAVE_YES_NO_OPTIONS = PARTNER_ALIGNMENT_IMPORTANCE_OPTIONS;

/** Picker options for onboarding / edit profile; persisted values are 4-level slugs. */
export const PREF_PARTNER_SHARES_SEXUAL_INTERESTS_YES_NO = PARTNER_ALIGNMENT_IMPORTANCE_OPTIONS;

/** Selected row in the importance sheet (`''` when unset). Legacy Dealbreaker/Yes/No still resolve. */
export function prefPartnerSharesSexualInterestsYesNoSelected(stored: string): string {
  return partnerAlignmentImportancePickerValue(stored);
}

/** Persists the 4-level slug (legacy Yes/No still accepted). */
export function prefPartnerSharesSexualInterestsFromYesNo(yesNo: string): string {
  return parsePartnerAlignmentImportance(yesNo) ?? String(yesNo ?? '').trim();
}

/** Trigger label: full importance copy, or Select. */
export function labelForPrefPartnerSharesSexualInterestsYesNoPicker(stored: string): string {
  const parsed = parsePartnerAlignmentImportance(stored);
  if (!parsed) return String(stored ?? '').trim() ? String(stored).trim() : 'Select';
  return partnerAlignmentImportanceLabel(parsed) || 'Select';
}

/** Stored in `sexInterestCategories` as each option's `value` (stable slug). */
export const SEX_INTEREST_CATEGORY_OPTIONS: { label: string; value: string }[] = [
  { label: 'I prefer a more traditional / vanilla dynamic', value: 'traditional_vanilla' },
  { label: "I'm open to exploring with the right partner", value: 'open_exploring_partner' },
  { label: "I've explored some kink and enjoy it occasionally", value: 'kink_occasional' },
  { label: 'I actively enjoy kink as part of my sex life', value: 'kink_active' },
  {
    label: "I have a strong kink identity and it's important to my compatibility",
    value: 'kink_identity_compatibility',
  },
];

export function sexualCompatStepComplete(v: {
  prefPhysicalCompatImportance?: unknown;
  prefPartnerSharesSexualInterests?: unknown;
  sexDrive?: unknown;
}): boolean {
  const s = (x: unknown) => String(x ?? '').trim();
  return (
    s(v.prefPhysicalCompatImportance) !== '' &&
    s(v.prefPartnerSharesSexualInterests) !== '' &&
    s(v.sexDrive) !== ''
  );
}
