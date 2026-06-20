/** Signup / referral code that routes users into the relationship validation cohort. */
export const RELATIONSHIP_VALIDATION_REFERRAL_CODE = 'RELATIONSHIP';

export const RELATIONSHIP_VALIDATION_TRACK = 'relationship';

export function isRelationshipValidationReferralCode(raw: string | null | undefined): boolean {
  return String(raw ?? '')
    .trim()
    .toUpperCase() === RELATIONSHIP_VALIDATION_REFERRAL_CODE;
}

/** Post-interview-style instruments used in the validation study (same battery as profile typologies). */
export const RELATIONSHIP_VALIDATION_INSTRUMENT_IDS = [
  'SEXUAL_COMMUNICATION',
  'PVQ-21',
  'CONFLICT-30',
  'ECR-36',
] as const;

export type RelationshipValidationInstrumentId =
  (typeof RELATIONSHIP_VALIDATION_INSTRUMENT_IDS)[number];

export type RelationshipDurationOption =
  | 'less_than_6_months'
  | '6_12_months'
  | '1_2_years'
  | '3_5_years'
  | '5_plus_years';

export type RelationshipValidationTestMode = 'romantic' | 'platonic';

export const RELATIONSHIP_DURATION_OPTIONS: {
  value: RelationshipDurationOption;
  label: string;
}[] = [
  { value: 'less_than_6_months', label: 'Less than 6 months' },
  { value: '6_12_months', label: '6–12 months' },
  { value: '1_2_years', label: '1–2 years' },
  { value: '3_5_years', label: '3–5 years' },
  { value: '5_plus_years', label: '5+ years' },
];

/** When a past relationship ended (platonic validation test mode). */
export type PlatonicPastRelationshipEndedOption =
  | 'less_than_6_months_ago'
  | '6_12_months_ago'
  | '1_2_years_ago'
  | '3_5_years_ago'
  | '5_plus_years_ago';

export const PLATONIC_PAST_RELATIONSHIP_ENDED_OPTIONS: {
  value: PlatonicPastRelationshipEndedOption;
  label: string;
}[] = [
  { value: 'less_than_6_months_ago', label: 'Less than 6 months ago' },
  { value: '6_12_months_ago', label: '6–12 months ago' },
  { value: '1_2_years_ago', label: '1–2 years ago' },
  { value: '3_5_years_ago', label: '3–5 years ago' },
  { value: '5_plus_years_ago', label: '5+ years or more ago' },
];

export type RelationshipEndingConsideration = 'never' | 'rarely' | 'sometimes' | 'often';

export const RELATIONSHIP_ENDING_OPTIONS: {
  value: RelationshipEndingConsideration;
  label: string;
}[] = [
  { value: 'never', label: 'Never' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'often', label: 'Often' },
];

export type RelationshipValidationPreAssessment = {
  duration: RelationshipDurationOption;
  overallCompatibility: number;
  conflictHandling: number;
  valuesAlignment: number;
  emotionalAttunement: number;
  consideredEnding: RelationshipEndingConsideration;
  overallSatisfaction: number;
};

export type RelationshipValidationPostAssessment = {
  scoreAccuracy: number;
  mostAccurateDimension: 'attachment' | 'values' | 'conflict_style' | 'overall';
  leastAccurateDimension:
    | 'attachment'
    | 'values'
    | 'conflict_style'
    | 'overall'
    | 'none_surprising';
  selfSurpriseText?: string | null;
  partnerSurpriseText?: string | null;
  hypotheticalInterest: number;
  reportValue: number;
  reportImprovementText?: string | null;
};

export type RelationshipValidationCompatibilityBreakdown = {
  attachment: number;
  values: number;
  conflictStyle: number;
  finalScore: number;
};
