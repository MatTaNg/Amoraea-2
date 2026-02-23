/** Schema for compatibility form answers stored in compatibility_data JSONB */

export interface CompatibilityFormData {
  // Kids
  kidsWanted: '0' | '1' | '2' | '3' | '4' | '5_plus' | null;
  openToAdopting: boolean | null;
  kidsExisting: '0' | '1' | '2' | '3' | '4' | '5_plus' | null;

  // Relationship
  relationshipType: 'monogamy' | 'enm' | 'poly' | 'unsure' | null;
  marriagePartnershipPreference: 'yes' | 'married_not_legal' | 'committed_no_marriage' | 'no_commitment' | null;

  // Religion & spirituality
  religiousIdentity:
    | 'christian'
    | 'muslim'
    | 'jewish'
    | 'hindu'
    | 'buddhist'
    | 'spiritual_not_religious'
    | 'atheist_agnostic'
    | 'other'
    | 'prefer_not_say'
    | null;
  faithPracticeLevel: 'never' | 'occasionally' | 'regularly' | 'central_to_life' | null;
  partnerSharesFaithPracticeImportance: number | null; // 1-7

  // Location
  futureLivingLocation: ('city' | 'suburban' | 'rural' | 'nomadic' | 'off_grid' | 'unsure')[];
  willingToRelocate: boolean | null;

  // Time
  workWeekHours: '0_20' | '21_30' | '31_40' | '41_50' | '51_60' | '60_plus' | null;
  hoursPerWeekQualityTime: '0_5' | '6_10' | '11_15' | '16_20' | '21_30' | '31_plus' | null;

  // Sex / intimacy
  sexualConnectionImportance: number | null; // 1-7
  sexFrequency: 'rarely' | 'once_week' | '2_3_week' | 'several_week' | 'daily' | 'prefer_not' | null;
  sexFrequencyFlexible: boolean | null;
  sexualExplorationOpenness: number | null; // 1-7

  // Financial support
  financialSupportExpectation: 1 | 2 | 3 | 4 | null;
  partnerSharesFinancialValuesImportance: number | null; // 1-7

  // Financial structure
  financialStructure: 1 | 2 | 3 | 4 | null;
  partnerSharesFinancialStructureImportance: number | null; // 1-7

  // Financial risk
  financialRiskComfort: number | null; // 1-7

  // Income & physical
  incomeRange: string | null;
  partnerSimilarFinancialPositionImportance: number | null; // 1-7
  weight: '100_120' | '121_140' | '141_160' | '161_180' | '181_200' | '200_plus' | 'prefer_not' | null;

  /** Partner body type (BMI) preference from BMI selector. null = not set. */
  partnerBMIPreference:
    | { noPreference: true }
    | { minBMI: number; maxBMI: number; minId: number; maxId: number }
    | null;

  // Cleanliness
  cleanlinessPreference: 1 | 2 | 3 | 4 | 5 | null;
  partnerSharesCleanlinessImportance: number | null; // 1-7

  // Pets
  hasPets: 'none' | 'dog' | 'cat' | 'other' | null;
  partnerHasPetsPreference: 'love_it' | 'fine' | 'depends' | 'prefer_not' | 'dealbreaker' | null;

  // Substance use
  alcoholFrequency: 'never' | 'rarely' | 'socially' | 'regularly' | 'daily' | null;
  partnerDrinksComfort: 'yes_fine' | 'socially_fine' | 'prefer_not' | 'no' | null;
  cigaretteFrequency: 'never' | 'rarely' | 'socially' | 'regularly' | 'daily' | null;
  partnerCigarettesComfort: 'yes_fine' | 'socially_fine' | 'prefer_not' | 'no' | null;
  cannabisTobaccoFrequency: 'never' | 'only_ceremonially' | 'rarely' | 'socially' | 'regularly' | 'daily' | null;
  partnerCannabisTobaccoComfort: 'yes_fine' | 'socially_fine' | 'only_ceremonially' | 'prefer_not' | 'no' | null;
  recreationalDrugsFrequency: 'never' | 'only_ceremonially' | 'rarely' | 'socially' | 'regularly' | 'daily' | null;
  partnerRecreationalDrugsComfort: 'yes_fine' | 'socially_fine' | 'only_ceremonially' | 'prefer_not' | 'no' | null;
}

export const defaultCompatibilityFormData: CompatibilityFormData = {
  kidsWanted: null,
  openToAdopting: null,
  kidsExisting: null,
  relationshipType: null,
  marriagePartnershipPreference: null,
  religiousIdentity: null,
  faithPracticeLevel: null,
  partnerSharesFaithPracticeImportance: null,
  futureLivingLocation: [],
  willingToRelocate: null,
  workWeekHours: null,
  hoursPerWeekQualityTime: null,
  sexualConnectionImportance: null,
  sexFrequency: null,
  sexFrequencyFlexible: null,
  sexualExplorationOpenness: null,
  financialSupportExpectation: null,
  partnerSharesFinancialValuesImportance: null,
  financialStructure: null,
  partnerSharesFinancialStructureImportance: null,
  financialRiskComfort: null,
  incomeRange: null,
  partnerSimilarFinancialPositionImportance: null,
  weight: null,
  partnerBMIPreference: null,
  cleanlinessPreference: null,
  partnerSharesCleanlinessImportance: null,
  hasPets: null,
  partnerHasPetsPreference: null,
  alcoholFrequency: null,
  partnerDrinksComfort: null,
  cigaretteFrequency: null,
  partnerCigarettesComfort: null,
  cannabisTobaccoFrequency: null,
  partnerCannabisTobaccoComfort: null,
  recreationalDrugsFrequency: null,
  partnerRecreationalDrugsComfort: null,
};
