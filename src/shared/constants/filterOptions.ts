export type ChoiceOption = { label: string; value: string };

function opts(labels: string[]): ChoiceOption[] {
  return labels.map((label) => ({ label, value: label }));
}

export const workoutOptions = opts(['Never', '1–2×/week', '3–5×/week', 'Daily']);
/** Cigarettes / tobacco / vaping — stored on profile as the chosen string. */
export const smokingOptions: ChoiceOption[] = [
  { label: 'No', value: 'No' },
  { label: 'Occasionally / Socially', value: 'Occasionally / Socially' },
  { label: 'Yes, regularly', value: 'Yes, regularly' },
  { label: 'I vape', value: 'I vape' },
  { label: 'Trying to quit', value: 'Trying to quit' },
];
/** Self-reported relationship with alcohol — stored on profile as the chosen string. */
export const drinkingOptions: ChoiceOption[] = [
  { label: "I don't drink", value: "I don't drink" },
  { label: 'I drink socially', value: 'I drink socially' },
  { label: 'I drink regularly', value: 'I drink regularly' },
  { label: 'Drinking is a big part of my life', value: 'Drinking is a big part of my life' },
  { label: "I'm sober or in recovery", value: "I'm sober or in recovery" },
];

/** Social / party drugs (e.g. MDMA, cocaine) — stored as `recreationalDrugsSocial` on profile. */
export const recreationalDrugsSocialOptions: ChoiceOption[] = [
  { label: 'Never', value: 'Never' },
  { label: 'Rarely', value: 'Rarely' },
  { label: 'Sometimes', value: 'Sometimes' },
  { label: "Yes, it's part of my social life", value: "Yes, it's part of my social life" },
];

/** Psychedelics / plant medicines — stored as `relationshipWithPsychedelics` on profile. */
export const psychedelicsRelationshipOptions: ChoiceOption[] = [
  { label: 'I have no interest / against it', value: 'I have no interest / against it' },
  { label: "Curious but haven't explored", value: "Curious but haven't explored" },
  { label: "I've experimented occasionally", value: "I've experimented occasionally" },
  {
    label: "It's still part of my growth / healing path",
    value: "It's still part of my growth / healing path",
  },
  {
    label: 'It used to be part of my growth / healing path',
    value: 'It used to be part of my growth / healing path',
  },
  {
    label: "It's a core part of my lifestyle and practice",
    value: "It's a core part of my lifestyle and practice",
  },
];

/** Relationship with cannabis — stored on profile as `relationshipWithCannabis` (merged into profile_json). */
export const cannabisRelationshipOptions: ChoiceOption[] = [
  { label: "I don't use it", value: "I don't use it" },
  { label: 'Occasionally / Socially', value: 'Occasionally / Socially' },
  { label: "Regularly, it's part of my life", value: "Regularly, it's part of my life" },
  { label: 'Intentionally / ceremonially', value: 'Intentionally / ceremonially' },
  { label: 'I am recovering', value: 'I am recovering' },
];

export const politicsOptions = opts(['Apolitical', 'Moderate', 'Progressive', 'Conservative', 'Other']);
export const religionOptions = opts(['Spiritual', 'Christian', 'Jewish', 'Muslim', 'Hindu', 'Agnostic', 'Atheist', 'Other']);
export const haveKidsOptions = opts(['No', 'Yes']);
export const wantChildrenYesNoOptions = opts(["Don't want kids", 'Undecided', 'Want kids']);

/** Partner dealbreaker: alignment on substance use (onboarding match preferences). */
export const PARTNER_SUBSTANCE_ALIGNMENT_OPTIONS: string[] = [
  'Yes',
  'No',
  'My partner can have a similar relationship as me but does not need to be exact',
];

export function normalizeWantKidsToYesNo(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).trim();
  if (!s) return undefined;
  return s;
}
