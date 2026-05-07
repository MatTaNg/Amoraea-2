/**
 * Fixed option sets for onboarding typology dropdowns (stored in profile `questionAnswers`).
 * Values are the display strings unless noted.
 */

const ZODIAC = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

const zodiacOptions = ZODIAC.map((s) => ({ label: s, value: s }));

export const EROTIC_BLUEPRINT_OPTIONS = [
  { label: 'Sexual', value: 'Sexual' },
  { label: 'Sensual', value: 'Sensual' },
  { label: 'Energetic', value: 'Energetic' },
  { label: 'Kinky', value: 'Kinky' },
  { label: 'Shapeshifter', value: 'Shapeshifter' },
] as const;

export const LOVE_LANGUAGE_OPTIONS = [
  { label: 'Acts of Service', value: 'Acts of Service' },
  { label: 'Receiving Gifts', value: 'Receiving Gifts' },
  { label: 'Quality Time', value: 'Quality Time' },
  { label: 'Physical Touch', value: 'Physical Touch' },
  { label: 'Words of Affirmation', value: 'Words of Affirmation' },
] as const;

export const MBTI_OPTIONS = [
  { label: 'INTJ - The Architect', value: 'INTJ - The Architect' },
  { label: 'INTP - The Thinker', value: 'INTP - The Thinker' },
  { label: 'ENTJ - The Commander', value: 'ENTJ - The Commander' },
  { label: 'ENTP - The Debater', value: 'ENTP - The Debater' },
  { label: 'INFJ - The Advocate', value: 'INFJ - The Advocate' },
  { label: 'INFP - The Mediator', value: 'INFP - The Mediator' },
  { label: 'ENFJ - The Protagonist', value: 'ENFJ - The Protagonist' },
  { label: 'ENFP - The Campaigner', value: 'ENFP - The Campaigner' },
  { label: 'ISTJ - The Logistician', value: 'ISTJ - The Logistician' },
  { label: 'ISFJ - The Defender', value: 'ISFJ - The Defender' },
  { label: 'ESTJ - The Executive', value: 'ESTJ - The Executive' },
  { label: 'ESFJ - The Consul', value: 'ESFJ - The Consul' },
  { label: 'ISTP - The Virtuoso', value: 'ISTP - The Virtuoso' },
  { label: 'ISFP - The Adventurer', value: 'ISFP - The Adventurer' },
  { label: 'ESTP - The Entrepreneur', value: 'ESTP - The Entrepreneur' },
  { label: 'ESFP - The Entertainer', value: 'ESFP - The Entertainer' },
] as const;

export const ENNEAGRAM_TYPE_OPTIONS = [
  { label: '1 - The Reformer', value: '1 - The Reformer' },
  { label: '2 - The Helper', value: '2 - The Helper' },
  { label: '3 - The Achiever', value: '3 - The Achiever' },
  { label: '4 - The Individualist', value: '4 - The Individualist' },
  { label: '5 - The Investigator', value: '5 - The Investigator' },
  { label: '6 - The Loyalist', value: '6 - The Loyalist' },
  { label: '7 - The Enthusiast', value: '7 - The Enthusiast' },
  { label: '8 - The Challenger', value: '8 - The Challenger' },
  { label: '9 - The Peacemaker', value: '9 - The Peacemaker' },
] as const;

export const ENNEAGRAM_WING_OPTIONS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => ({
  label: n,
  value: n,
}));

export const ENNEAGRAM_INSTINCT_OPTIONS = [
  { label: 'Self-Preservation (SP)', value: 'Self-Preservation (SP)' },
  { label: 'Sexual / One-to-One (SX)', value: 'Sexual / One-to-One (SX)' },
  { label: 'Social (SO)', value: 'Social (SO)' },
] as const;

export const HUMAN_DESIGN_TYPE_OPTIONS = [
  { label: 'Generator', value: 'Generator' },
  { label: 'Manifesting Generator', value: 'Manifesting Generator' },
  { label: 'Manifestor', value: 'Manifestor' },
  { label: 'Projector', value: 'Projector' },
  { label: 'Reflector', value: 'Reflector' },
] as const;

export const HUMAN_DESIGN_AUTHORITY_OPTIONS = [
  { label: 'Emotional', value: 'Emotional' },
  { label: 'Sacral', value: 'Sacral' },
  { label: 'Splenic', value: 'Splenic' },
] as const;

export const HUMAN_DESIGN_PROFILE_OPTIONS = [
  { label: '1/3 - The Investigator / Martyr', value: '1/3 - The Investigator / Martyr' },
  { label: '1/4 - The Investigator / Opportunist', value: '1/4 - The Investigator / Opportunist' },
  { label: '2/4 - The Hermit / Opportunist', value: '2/4 - The Hermit / Opportunist' },
  { label: '2/5 - The Hermit / Heretic', value: '2/5 - The Hermit / Heretic' },
  { label: '3/5 - The Martyr / Heretic', value: '3/5 - The Martyr / Heretic' },
  { label: '3/6 - The Martyr / Role Model', value: '3/6 - The Martyr / Role Model' },
  { label: '4/6 - The Opportunist / Role Model', value: '4/6 - The Opportunist / Role Model' },
  { label: '4/1 - The Opportunist / Investigator', value: '4/1 - The Opportunist / Investigator' },
  { label: '5/1 - The Heretic / Investigator', value: '5/1 - The Heretic / Investigator' },
  { label: '5/2 - The Heretic / Hermit', value: '5/2 - The Heretic / Hermit' },
  { label: '6/2 - The Role Model / Hermit', value: '6/2 - The Role Model / Hermit' },
  { label: '6/3 - The Role Model / Martyr', value: '6/3 - The Role Model / Martyr' },
] as const;

export type TypologyOnboardingRow = {
  key: string;
  label: string;
  options: readonly { label: string; value: string }[];
};

export type TypologyOnboardingSection = {
  readonly title: string;
  readonly rows: readonly TypologyOnboardingRow[];
};

/** Grouped UI sections; all fields optional (empty selection = skip). */
export const TYPOLOGY_ONBOARDING_SECTIONS: readonly TypologyOnboardingSection[] = [
  {
    title: 'Erotic Blueprint',
    rows: [{ key: 'eroticBlueprintType', label: 'What is your Erotic Blueprint?', options: EROTIC_BLUEPRINT_OPTIONS }],
  },
  {
    title: 'Love Language',
    rows: [{ key: 'loveLanguage', label: 'What is your Love Language?', options: LOVE_LANGUAGE_OPTIONS }],
  },
  {
    title: 'Myers-Briggs',
    rows: [{ key: 'myersBriggs', label: 'What is your Myers-Briggs? (MBTI)', options: MBTI_OPTIONS }],
  },
  {
    title: 'Enneagram',
    rows: [
      { key: 'enneagramType', label: 'What is your Enneagram?', options: ENNEAGRAM_TYPE_OPTIONS },
      { key: 'enneagramWing', label: 'What is your Enneagram Wing?', options: ENNEAGRAM_WING_OPTIONS },
      { key: 'enneagramInstinct', label: 'What is your Enneagram Instinct?', options: ENNEAGRAM_INSTINCT_OPTIONS },
    ],
  },
  {
    title: 'Astrology',
    rows: [
      { key: 'sunSign', label: 'What is your Sun Sign?', options: zodiacOptions },
      { key: 'risingSign', label: 'What is your Rising Sign?', options: zodiacOptions },
      { key: 'moonSign', label: 'What is your Moon Sign?', options: zodiacOptions },
      { key: 'marsSign', label: 'What is your Mars Sign?', options: zodiacOptions },
      { key: 'venusSign', label: 'What is your Venus Sign?', options: zodiacOptions },
    ],
  },
  {
    title: 'Human Design',
    rows: [
      { key: 'humanDesignType', label: 'What is your Human Design Type?', options: HUMAN_DESIGN_TYPE_OPTIONS },
      { key: 'humanDesignAuthority', label: 'What is your Human Design Authority?', options: HUMAN_DESIGN_AUTHORITY_OPTIONS },
      { key: 'humanDesignProfile', label: 'What is your Human Design Profile Type?', options: HUMAN_DESIGN_PROFILE_OPTIONS },
    ],
  },
] as const;
