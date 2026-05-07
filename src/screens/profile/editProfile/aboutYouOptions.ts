import type { ChoiceOption } from '@/shared/components/profileFields/SingleChoiceOptionList';

export const ETHNICITY_CHOICES: ChoiceOption[] = [
  { label: 'Asian', value: 'Asian' },
  { label: 'Black / African descent', value: 'Black' },
  { label: 'Hispanic / Latino', value: 'Hispanic' },
  { label: 'White / European descent', value: 'White' },
  { label: 'Middle Eastern', value: 'Middle Eastern' },
  { label: 'Mixed / Other', value: 'Mixed' },
];

export const EDUCATION_LEVEL_CHOICES: ChoiceOption[] = [
  { label: 'High school', value: 'High school' },
  { label: 'Some college', value: 'Some college' },
  { label: "Bachelor's", value: "Bachelor's" },
  { label: 'Graduate degree', value: 'Graduate degree' },
];

export const ABOUT_DRUGS_CHOICES: ChoiceOption[] = [
  { label: 'Never', value: 'Never' },
  { label: 'Sometimes', value: 'Sometimes' },
  { label: 'Prefer not to say', value: 'Prefer not to say' },
];

/** Values must stay aligned with `mapRelationshipStyleToUi` in onboarding (`ModalOnboardingFlow`). */
export const RELATIONSHIP_STYLE_CHOICES: ChoiceOption[] = [
  { label: 'Monogamous', value: 'Monogamous' },
  { label: 'Polyamorous', value: 'Polyamorous' },
  { label: 'Monogamous-ish', value: 'Monogam-ish' },
  { label: 'Open', value: 'Open' },
  { label: 'Other', value: 'Other' },
];
