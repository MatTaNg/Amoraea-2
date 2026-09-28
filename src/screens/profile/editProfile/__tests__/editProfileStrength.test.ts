import { describe, expect, it } from '@jest/globals';
import { DEFAULT_ONBOARDING_LIFE_DOMAINS } from '@/shared/components/LifeDomainDistribution';
import { LIFE_DOMAIN_ONBOARDING_DOMAIN_ORDER, LIFE_DOMAIN_ONBOARDING_QUESTIONS } from '@/shared/constants/lifeDomainOnboardingQuestions';
import { TYPOLOGY_ONBOARDING_ROW_KEYS } from '@/shared/utils/typologyPickerValue';
import { computeEditProfileStrength } from '@/screens/profile/editProfile/editProfileStrength';

const LIFE_DOMAIN_QUESTION_COUNT = LIFE_DOMAIN_ONBOARDING_DOMAIN_ORDER.reduce(
  (sum, domainId) => sum + (LIFE_DOMAIN_ONBOARDING_QUESTIONS[domainId]?.length ?? 0),
  0,
);

const CORE_COMPLETE_INPUT = {
  draft: {
    displayName: 'Alex',
    gender: 'woman',
    ethnicity: 'White',
    birthDate: '1990-01-01',
    relationshipStyle: 'Monogamous',
    location: 'Austin, TX',
    occupation: 'Engineer',
    educationLevel: 'Bachelor',
    hobbies: 'h1,h2,h3',
    workout: '3-4 times per week',
    smoking: 'Never',
    drinking: 'Socially',
    haveKids: 'No',
    wantKids: 'Yes',
    politics: 'Moderate',
    religion: 'Spiritual',
    sexDrive: 'Weekly',
    questionAnswers: {},
  },
  photoUrls: ['https://example.com/photo.jpg'],
  attractedUi: ['Women'],
  sexInterestSelected: ['vanilla'],
  lifeDomainsState: { ...DEFAULT_ONBOARDING_LIFE_DOMAINS },
  weightKgPick: 70,
  heightCmPick: 175,
  typologyValues: {},
  matchPrefs: {
    longTermLivingPreference: 'City',
    lifestylePreference: 'Active',
    relocationPreference: 'Maybe',
    ageRange: [25, 40],
  },
  prefPhysicalCompatImportance: 'Important',
  prefPartnerSharesSexualInterests: 'Yes',
  prefPartnerHasChildren: 'No preference',
  prefPartnerPoliticalAlignmentImportance: 'Somewhat important',
  archetypeSelection: ['explorer', 'creator'] as ['explorer', 'creator'],
  lifeDomainAnswers: {},
  validatedBirthLocation: undefined,
  profilePrompts: [
    { promptId: 'what-matters-1', answer: 'Growth' },
  ],
};

describe('computeEditProfileStrength', () => {
  it('tracks each typology onboarding row separately', () => {
    const summary = computeEditProfileStrength(CORE_COMPLETE_INPUT);
    expect(summary.totalCount).toBeGreaterThanOrEqual(
      27 + TYPOLOGY_ONBOARDING_ROW_KEYS.length,
    );

    const typologyIncomplete = summary.incomplete.filter((item) =>
      item.id.startsWith('typology.'),
    );
    expect(typologyIncomplete).toHaveLength(TYPOLOGY_ONBOARDING_ROW_KEYS.length);
    expect(summary.percent).toBeLessThan(100);
  });

  it('increases completion when typology answers are provided', () => {
    const empty = computeEditProfileStrength(CORE_COMPLETE_INPUT);
    const partial = computeEditProfileStrength({
      ...CORE_COMPLETE_INPUT,
      typologyValues: {
        eroticBlueprintType: 'Sensual',
        loveLanguage: 'Quality Time',
      },
    });

    expect(partial.completedCount).toBe(empty.completedCount + 2);
    expect(partial.percent).toBeGreaterThan(empty.percent);
  });

  it('reads typology answers from draft.questionAnswers when state is empty', () => {
    const summary = computeEditProfileStrength({
      ...CORE_COMPLETE_INPUT,
      typologyValues: {},
      draft: {
        ...CORE_COMPLETE_INPUT.draft,
        questionAnswers: {
          eroticBlueprintType: 'Sensual',
          loveLanguage: 'Quality Time',
        },
      },
    });

    const typologyIncomplete = summary.incomplete.filter((item) =>
      item.id.startsWith('typology.'),
    );
    expect(typologyIncomplete).toHaveLength(TYPOLOGY_ONBOARDING_ROW_KEYS.length - 2);
  });

  it('tracks each life domain question separately', () => {
    const summary = computeEditProfileStrength(CORE_COMPLETE_INPUT);
    const lifeDomainIncomplete = summary.incomplete.filter((item) =>
      item.id.startsWith('lifeDomain.'),
    );
    expect(lifeDomainIncomplete).toHaveLength(LIFE_DOMAIN_QUESTION_COUNT);
    expect(summary.totalCount).toBeGreaterThanOrEqual(
      27 + TYPOLOGY_ONBOARDING_ROW_KEYS.length + LIFE_DOMAIN_QUESTION_COUNT,
    );
  });

  it('increases completion when life domain answers are provided', () => {
    const empty = computeEditProfileStrength(CORE_COMPLETE_INPUT);
    const partial = computeEditProfileStrength({
      ...CORE_COMPLETE_INPUT,
      lifeDomainAnswers: {
        finance: { yearlyIncome: '100k' },
        intimacy: { livingLocation: 'City' },
      },
    });

    expect(partial.completedCount).toBe(empty.completedCount + 2);
    expect(partial.percent).toBeGreaterThan(empty.percent);
  });
});
