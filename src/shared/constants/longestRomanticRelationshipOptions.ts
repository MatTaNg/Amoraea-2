import type { ChoiceOption } from '@/shared/components/profileFields/SingleChoiceOptionList';

/** Durations for “longest romantic relationship” (slugs stored on profile / onboarding). */
export const LONGEST_ROMANTIC_RELATIONSHIP_OPTIONS: ChoiceOption[] = [
  { label: 'Never been in one', value: 'never' },
  { label: 'Less than 6 months', value: 'under_6_months' },
  { label: '6–12 months', value: '6_to_12_months' },
  { label: '1–2 years', value: '1_to_2_years' },
  { label: '2–5 years', value: '2_to_5_years' },
  { label: 'More than 5 years', value: 'over_5_years' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];
