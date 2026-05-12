export const SEX_DRIVE_OPTIONS = [
  { label: 'Daily, or almost daily', value: 'Daily, or almost daily' },
  { label: '3-5x a week', value: '3-5x a week' },
  { label: '1-2x a week', value: '1-2x a week' },
  { label: 'A few times a month', value: 'A few times a month' },
];

export const DATING_PACE_AFTER_EXCITEMENT_OPTIONS = [
  'Slow and gradual',
  'Steady and consistent',
  "Fast when there's strong chemistry",
].map((label) => ({ label, value: label }));

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

export const SEXUAL_FEEDBACK_STYLE_OPTIONS = [
  'Bring it up directly — communication is how things improve',
  'Drop hints and hope my partner picks up on it',
  'Usually let it go to avoid making things awkward',
  'Depends on how comfortable I am with the person',
].map((label) => ({ label, value: label }));

export const SEXUAL_NEEDS_COMMUNICATION_OPTIONS = [
  'Very comfortable — I see it as an important part of intimacy',
  'Somewhat comfortable, though it can feel vulnerable',
  'I find it difficult but recognize it matters',
  'I prefer to let things develop naturally without explicit conversation',
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
