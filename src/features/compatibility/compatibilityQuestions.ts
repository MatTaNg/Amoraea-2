import type { CompatibilityFormData } from '@domain/models/CompatibilityForm';

/** Option for select / multi-select questions */
export interface CompatibilityOption<T = string | number> {
  value: T;
  label: string;
}

/** Single question config */
export type CompatibilityQuestionConfig =
  | {
      type: 'select';
      field: keyof CompatibilityFormData;
      label: string;
      options: CompatibilityOption[];
    }
  | {
      type: 'multiSelect';
      field: keyof CompatibilityFormData;
      label: string;
      options: CompatibilityOption[];
    }
  | {
      type: 'scale';
      field: keyof CompatibilityFormData;
      label: string;
      min: number;
      max: number;
    }
  | {
      type: 'switch';
      field: keyof CompatibilityFormData;
      label: string;
    };

/** Section: title + list of questions (in order) */
export interface CompatibilitySectionConfig {
  sectionTitle: string;
  questions: CompatibilityQuestionConfig[];
}

// ─── Option sets (reusable) ───────────────────────────────────────────────

export const RELATIONSHIP_OPTIONS: CompatibilityOption<CompatibilityFormData['relationshipType']>[] = [
  { value: 'monogamy', label: 'Monogamy' },
  { value: 'enm', label: 'ENM' },
  { value: 'poly', label: 'Poly' },
  { value: 'unsure', label: 'Unsure' },
];

export const MARRIAGE_PARTNERSHIP_OPTIONS: CompatibilityOption<
  CompatibilityFormData['marriagePartnershipPreference']
>[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'married_not_legal', label: '"Married" but not legally' },
  { value: 'committed_no_marriage', label: 'I do not want to be married but we can be in a committed partnership' },
  { value: 'no_commitment', label: 'I am not looking for any committed partnership' },
];

export const FUTURE_LIVING_OPTIONS: CompatibilityOption<string>[] = [
  { value: 'city', label: 'City' },
  { value: 'suburban', label: 'Suburban' },
  { value: 'rural', label: 'Rural' },
  { value: 'nomadic', label: 'Nomadic' },
  { value: 'off_grid', label: 'Off grid' },
  { value: 'unsure', label: 'Unsure' },
];

export const INCOME_RANGE_OPTIONS: CompatibilityOption<string>[] = [
  { value: 'under_500', label: 'Under $500' },
  { value: '500_1500', label: '$500–$1,500' },
  { value: '1500_3000', label: '$1,500–$3,000' },
  { value: '3000_6000', label: '$3,000–$6,000' },
  { value: '6000_plus', label: '$6,000+' },
];

export const FINANCIAL_SUPPORT_OPTIONS: CompatibilityOption<1 | 2 | 3 | 4>[] = [
  { value: 1, label: 'I expect full financial independence on both sides' },
  { value: 2, label: "I'm open to mutual support depending on circumstances" },
  { value: 3, label: 'I expect to provide more financial support' },
  { value: 4, label: 'I expect to receive more financial support' },
];

export const FINANCIAL_STRUCTURE_OPTIONS: CompatibilityOption<1 | 2 | 3 | 4>[] = [
  { value: 1, label: 'Fully pools finances' },
  { value: 2, label: 'Mostly pooled with some individual accounts' },
  { value: 3, label: 'Mostly separate with shared expenses' },
  { value: 4, label: 'Fully separate finances' },
];

export const CLEANLINESS_OPTIONS: CompatibilityOption<1 | 2 | 3 | 4 | 5>[] = [
  { value: 1, label: "Very relaxed (Clutter and mess don't bother me much)" },
  { value: 2, label: 'Moderately relaxed (Some clutter is fine)' },
  { value: 3, label: 'Balanced (generally tidy, occasional mess is okay)' },
  { value: 4, label: 'Very tidy (Things should usually be clean and organized)' },
  { value: 5, label: 'Highly structured (Clean and organized most of the time)' },
];

export const KIDS_OPTIONS: CompatibilityOption<CompatibilityFormData['kidsWanted']>[] = [
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5_plus', label: '5+' },
];

export const WORK_WEEK_HOURS_OPTIONS: CompatibilityOption<CompatibilityFormData['workWeekHours']>[] = [
  { value: '0_20', label: '0-20 hours' },
  { value: '21_30', label: '21-30 hours' },
  { value: '31_40', label: '31-40 hours' },
  { value: '41_50', label: '41-50 hours' },
  { value: '51_60', label: '51-60 hours' },
  { value: '60_plus', label: '60+ hours' },
];

export const HOURS_PER_WEEK_QUALITY_TIME_OPTIONS: CompatibilityOption<
  CompatibilityFormData['hoursPerWeekQualityTime']
>[] = [
  { value: '0_5', label: '0-5 hours' },
  { value: '6_10', label: '6-10 hours' },
  { value: '11_15', label: '11-15 hours' },
  { value: '16_20', label: '16-20 hours' },
  { value: '21_30', label: '21-30 hours' },
  { value: '31_plus', label: '31+ hours' },
];

export const SEX_FREQUENCY_OPTIONS: CompatibilityOption<CompatibilityFormData['sexFrequency']>[] = [
  { value: 'rarely', label: 'Rarely' },
  { value: 'once_week', label: 'Once a week' },
  { value: '2_3_week', label: '2-3 times per week' },
  { value: 'several_week', label: 'Several times per week' },
  { value: 'daily', label: 'Daily' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];

export const WEIGHT_OPTIONS: CompatibilityOption<CompatibilityFormData['weight']>[] = [
  { value: '100_120', label: '100-120 lbs' },
  { value: '121_140', label: '121-140 lbs' },
  { value: '141_160', label: '141-160 lbs' },
  { value: '161_180', label: '161-180 lbs' },
  { value: '181_200', label: '181-200 lbs' },
  { value: '200_plus', label: '200+ lbs' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];

export const HAS_PETS_OPTIONS: CompatibilityOption<CompatibilityFormData['hasPets']>[] = [
  { value: 'none', label: 'None' },
  { value: 'dog', label: 'Dog(s)' },
  { value: 'cat', label: 'Cat(s)' },
  { value: 'other', label: 'Other' },
];

export const PARTNER_HAS_PETS_OPTIONS: CompatibilityOption<
  CompatibilityFormData['partnerHasPetsPreference']
>[] = [
  { value: 'love_it', label: 'Love it' },
  { value: 'fine', label: 'Fine with it' },
  { value: 'depends', label: 'Depends on the animal' },
  { value: 'prefer_not', label: "I'd prefer they don't" },
  { value: 'dealbreaker', label: 'Dealbreaker (allergies or strong preference)' },
];

// Substance use
export const ALCOHOL_FREQUENCY_OPTIONS: CompatibilityOption<
  CompatibilityFormData['alcoholFrequency']
>[] = [
  { value: 'never', label: 'Never' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'daily', label: 'Daily' },
];

export const PARTNER_DRINKS_COMFORT_OPTIONS: CompatibilityOption<
  CompatibilityFormData['partnerDrinksComfort']
>[] = [
  { value: 'yes_fine', label: 'Yes, fine' },
  { value: 'socially_fine', label: 'Socially is fine, not regularly' },
  { value: 'prefer_not', label: "I'd prefer they don't" },
  { value: 'no', label: 'No' },
];

export const CIGARETTE_FREQUENCY_OPTIONS: CompatibilityOption<
  CompatibilityFormData['cigaretteFrequency']
>[] = [
  { value: 'never', label: 'Never' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'daily', label: 'Daily' },
];

export const PARTNER_CIGARETTES_COMFORT_OPTIONS: CompatibilityOption<
  CompatibilityFormData['partnerCigarettesComfort']
>[] = [
  { value: 'yes_fine', label: 'Yes, fine' },
  { value: 'socially_fine', label: 'Socially is fine, not regularly' },
  { value: 'prefer_not', label: "I'd prefer they don't" },
  { value: 'no', label: 'No' },
];

export const CANNABIS_TOBACCO_FREQUENCY_OPTIONS: CompatibilityOption<
  CompatibilityFormData['cannabisTobaccoFrequency']
>[] = [
  { value: 'never', label: 'Never' },
  { value: 'only_ceremonially', label: 'Only ceremonially' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'daily', label: 'Daily' },
];

export const PARTNER_CANNABIS_TOBACCO_COMFORT_OPTIONS: CompatibilityOption<
  CompatibilityFormData['partnerCannabisTobaccoComfort']
>[] = [
  { value: 'yes_fine', label: 'Yes, fine' },
  { value: 'socially_fine', label: 'Socially is fine, not regularly' },
  { value: 'only_ceremonially', label: 'Only ceremonially' },
  { value: 'prefer_not', label: "I'd prefer they don't" },
  { value: 'no', label: 'No' },
];

export const RECREATIONAL_DRUGS_FREQUENCY_OPTIONS: CompatibilityOption<
  CompatibilityFormData['recreationalDrugsFrequency']
>[] = [
  { value: 'never', label: 'Never' },
  { value: 'only_ceremonially', label: 'Only ceremonially' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'daily', label: 'Daily' },
];

export const PARTNER_RECREATIONAL_DRUGS_COMFORT_OPTIONS: CompatibilityOption<
  CompatibilityFormData['partnerRecreationalDrugsComfort']
>[] = [
  { value: 'yes_fine', label: 'Yes, fine' },
  { value: 'socially_fine', label: 'Socially is fine, not regularly' },
  { value: 'only_ceremonially', label: 'Only ceremonially' },
  { value: 'prefer_not', label: "I'd prefer they don't" },
  { value: 'no', label: 'No' },
];

// Religion & spirituality
export const RELIGIOUS_IDENTITY_OPTIONS: CompatibilityOption<
  CompatibilityFormData['religiousIdentity']
>[] = [
  { value: 'christian', label: 'Christian' },
  { value: 'muslim', label: 'Muslim' },
  { value: 'jewish', label: 'Jewish' },
  { value: 'hindu', label: 'Hindu' },
  { value: 'buddhist', label: 'Buddhist' },
  { value: 'spiritual_not_religious', label: 'Spiritual but not religious' },
  { value: 'atheist_agnostic', label: 'Atheist/Agnostic' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_say', label: 'Prefer not to say' },
];

export const FAITH_PRACTICE_LEVEL_OPTIONS: CompatibilityOption<
  CompatibilityFormData['faithPracticeLevel']
>[] = [
  { value: 'never', label: 'Never' },
  { value: 'occasionally', label: 'Occasionally' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'central_to_life', label: "It's central to my life" },
];

// Value arrays for parsing stored data
export const KIDS_VALUES = ['0', '1', '2', '3', '4', '5_plus'] as const;
export const WORK_HOURS_VALUES = ['0_20', '21_30', '31_40', '41_50', '51_60', '60_plus'] as const;
export const HOURS_PER_WEEK_VALUES = ['0_5', '6_10', '11_15', '16_20', '21_30', '31_plus'] as const;
export const SEX_FREQ_VALUES = ['rarely', 'once_week', '2_3_week', 'several_week', 'daily', 'prefer_not'] as const;
export const WEIGHT_VALUES = ['100_120', '121_140', '141_160', '161_180', '181_200', '200_plus', 'prefer_not'] as const;

// ─── Single source of truth: sections and questions ───────────────────────

export const COMPATIBILITY_SECTIONS: CompatibilitySectionConfig[] = [
  {
    sectionTitle: 'Family & Kids',
    questions: [
      { type: 'select', field: 'kidsWanted', label: 'How many kids do you want?', options: KIDS_OPTIONS },
      { type: 'switch', field: 'openToAdopting', label: 'Are you open to adopting kids?' },
      { type: 'select', field: 'kidsExisting', label: 'How many children do you already have?', options: KIDS_OPTIONS },
    ],
  },
  {
    sectionTitle: 'Relationship',
    questions: [
      { type: 'select', field: 'relationshipType', label: 'What kind of relationship are you looking for?', options: RELATIONSHIP_OPTIONS },
      {
        type: 'select',
        field: 'marriagePartnershipPreference',
        label: 'Do you want marriage or a legally committed partnership?',
        options: MARRIAGE_PARTNERSHIP_OPTIONS,
      },
    ],
  },
  {
    sectionTitle: 'Religion & Spirituality',
    questions: [
      {
        type: 'select',
        field: 'religiousIdentity',
        label: 'What is your religious or spiritual identity?',
        options: RELIGIOUS_IDENTITY_OPTIONS,
      },
      {
        type: 'select',
        field: 'faithPracticeLevel',
        label: 'How actively do you practice your faith?',
        options: FAITH_PRACTICE_LEVEL_OPTIONS,
      },
      {
        type: 'scale',
        field: 'partnerSharesFaithPracticeImportance',
        label: 'How important is it that your partner shares your level of practice? (1–7)',
        min: 1,
        max: 7,
      },
    ],
  },
  {
    sectionTitle: 'Location',
    questions: [
      {
        type: 'multiSelect',
        field: 'futureLivingLocation',
        label: 'Where do you see yourself living in the future? (Select all that apply)',
        options: FUTURE_LIVING_OPTIONS,
      },
      { type: 'switch', field: 'willingToRelocate', label: 'Are you willing to relocate?' },
    ],
  },
  {
    sectionTitle: 'Time & Availability',
    questions: [
      { type: 'select', field: 'workWeekHours', label: 'Typical work week hours', options: WORK_WEEK_HOURS_OPTIONS },
      {
        type: 'select',
        field: 'hoursPerWeekQualityTime',
        label: 'Hours per week of quality time desired',
        options: HOURS_PER_WEEK_QUALITY_TIME_OPTIONS,
      },
    ],
  },
  {
    sectionTitle: 'Sex & Intimacy',
    questions: [
      {
        type: 'scale',
        field: 'sexualConnectionImportance',
        label: 'How important is sex to you in a romantic relationship? (1-7)',
        min: 1,
        max: 7,
      },
      { type: 'select', field: 'sexFrequency', label: 'How often do you desire to have sex?', options: SEX_FREQUENCY_OPTIONS },
      { type: 'switch', field: 'sexFrequencyFlexible', label: 'Is this frequency flexible?' },
      {
        type: 'scale',
        field: 'sexualExplorationOpenness',
        label: 'How open are you to exploring new sexual experiences with a partner? (1 = Very Closed, 7 = Very Open)',
        min: 1,
        max: 7,
      },
    ],
  },
  {
    sectionTitle: 'Financial Values',
    questions: [
      {
        type: 'select',
        field: 'financialSupportExpectation',
        label: 'Which best reflects your expectations around financial support in a relationship?',
        options: FINANCIAL_SUPPORT_OPTIONS,
      },
      {
        type: 'scale',
        field: 'partnerSharesFinancialValuesImportance',
        label: 'How important is it to you that your partner shares these values? (1-7)',
        min: 1,
        max: 7,
      },
      {
        type: 'select',
        field: 'financialStructure',
        label: 'In a committed relationship, which financial structure feels more natural to you?',
        options: FINANCIAL_STRUCTURE_OPTIONS,
      },
      {
        type: 'scale',
        field: 'partnerSharesFinancialStructureImportance',
        label: 'How important is it to you that your partner shares these values? (1-7)',
        min: 1,
        max: 7,
      },
      {
        type: 'scale',
        field: 'financialRiskComfort',
        label: 'How comfortable are you with financial risk? (1 = Very uncomfortable, 7 = Very Comfortable)',
        min: 1,
        max: 7,
      },
      { type: 'select', field: 'incomeRange', label: 'After rent/mortgage, bills, debt, and regular expenses, approximately how much do you have left each month in disposable income?', options: INCOME_RANGE_OPTIONS },
      {
        type: 'scale',
        field: 'partnerSimilarFinancialPositionImportance',
        label: 'How important is it that your partner is in a similar financial position? (1–7)',
        min: 1,
        max: 7,
      },
    ],
  },
  {
    sectionTitle: 'Living Habits',
    questions: [
      {
        type: 'select',
        field: 'cleanlinessPreference',
        label: 'Which best describes your preferred baseline for cleanliness in shared living spaces?',
        options: CLEANLINESS_OPTIONS,
      },
      {
        type: 'scale',
        field: 'partnerSharesCleanlinessImportance',
        label: 'How important is it that your partner shares your same cleanliness habits? (1-7)',
        min: 1,
        max: 7,
      },
    ],
  },
  {
    sectionTitle: 'Pets',
    questions: [
      { type: 'select', field: 'hasPets', label: 'Do you have pets?', options: HAS_PETS_OPTIONS },
      {
        type: 'select',
        field: 'partnerHasPetsPreference',
        label: 'How do you feel about a partner who has pets?',
        options: PARTNER_HAS_PETS_OPTIONS,
      },
    ],
  },
  {
    sectionTitle: 'Substance Use',
    questions: [
      {
        type: 'select',
        field: 'alcoholFrequency',
        label: 'How often do you drink alcohol?',
        options: ALCOHOL_FREQUENCY_OPTIONS,
      },
      {
        type: 'select',
        field: 'partnerDrinksComfort',
        label: 'Are you comfortable with a partner who drinks?',
        options: PARTNER_DRINKS_COMFORT_OPTIONS,
      },
      {
        type: 'select',
        field: 'cigaretteFrequency',
        label: 'Do you smoke cigarettes?',
        options: CIGARETTE_FREQUENCY_OPTIONS,
      },
      {
        type: 'select',
        field: 'partnerCigarettesComfort',
        label: 'Are you comfortable with a partner who smokes cigarettes?',
        options: PARTNER_CIGARETTES_COMFORT_OPTIONS,
      },
      {
        type: 'select',
        field: 'cannabisTobaccoFrequency',
        label: 'Do you use cannabis or tobacco?',
        options: CANNABIS_TOBACCO_FREQUENCY_OPTIONS,
      },
      {
        type: 'select',
        field: 'partnerCannabisTobaccoComfort',
        label: 'Are you comfortable with a partner who uses cannabis or tobacco?',
        options: PARTNER_CANNABIS_TOBACCO_COMFORT_OPTIONS,
      },
      {
        type: 'select',
        field: 'recreationalDrugsFrequency',
        label: 'Do you use recreational drugs beyond alcohol, cannabis or tobacco?',
        options: RECREATIONAL_DRUGS_FREQUENCY_OPTIONS,
      },
      {
        type: 'select',
        field: 'partnerRecreationalDrugsComfort',
        label: 'Are you comfortable with a partner who does?',
        options: PARTNER_RECREATIONAL_DRUGS_COMFORT_OPTIONS,
      },
    ],
  },
];
