/** Schema for compatibility form answers stored in compatibility_data JSONB */

export interface CompatibilityFormData {
  // Kids
  kidsWanted: '0' | '1' | '2' | '3' | '4' | '5_plus' | null;
  openToAdopting: boolean | null;
  kidsExisting: '0' | '1' | '2' | '3' | '4' | '5_plus' | null;

  // Relationship
  relationshipType: 'monogamy' | 'enm' | 'poly' | 'unsure' | null;
  marriagePartnershipPreference: 'yes' | 'married_not_legal' | 'committed_no_marriage' | 'no_commitment' | null;

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
  weight: '100_120' | '121_140' | '141_160' | '161_180' | '181_200' | '200_plus' | 'prefer_not' | null;

  // Cleanliness
  cleanlinessPreference: 1 | 2 | 3 | 4 | 5 | null;
  partnerSharesCleanlinessImportance: number | null; // 1-7
}

export const defaultCompatibilityFormData: CompatibilityFormData = {
  kidsWanted: null,
  openToAdopting: null,
  kidsExisting: null,
  relationshipType: null,
  marriagePartnershipPreference: null,
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
  weight: null,
  cleanlinessPreference: null,
  partnerSharesCleanlinessImportance: null,
};
