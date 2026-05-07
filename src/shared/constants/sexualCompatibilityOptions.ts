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
