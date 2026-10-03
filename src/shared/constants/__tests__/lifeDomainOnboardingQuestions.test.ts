import { describe, expect, it } from '@jest/globals';
import {
  countAnsweredInDomain,
  getActiveLifeDomainOptionalOpenEndedSteps,
  getActiveLifeDomainRequiredQuestionSteps,
  getEssentialsProfileQuestions,
  getLeftoverOptionalOpenEndedQuestionsForDomain,
  isWantKidsRelevantForLifeDomains,
  LIFE_DOMAIN_ONBOARDING_QUESTIONS,
  lifeDomainOptionalOpenEndedStepId,
  relocatedEssentialsQuestionResumeStep,
  validateLifeDomainStep,
} from '../lifeDomainOnboardingQuestions';

describe('lifeDomainOnboardingQuestions validation', () => {
  it('does not treat relocated essentials questions as life-domain requirements', () => {
    for (const domainId of ['finance', 'intimacy', 'spirituality', 'family', 'health'] as const) {
      const result = validateLifeDomainStep(domainId, {}, { enforceRequired: true, wantKids: 'Want kids' });
      expect(result.valid).toBe(true);
      expect(result.missingQuestions).toEqual([]);
    }
  });

  it('does not require chronicIllnessStatus on health step', () => {
    const result = validateLifeDomainStep(
      'health',
      { sleepSchedule: 'Night owl — I come alive in the evenings' },
      { enforceRequired: true },
    );
    expect(result.valid).toBe(true);
    expect(result.missingQuestions.some((q) => q.id === 'chronicIllnessStatus')).toBe(false);
  });

  it('skips required validation when enforceRequired is false (grandfather / edit profile)', () => {
    const result = validateLifeDomainStep('finance', {}, { enforceRequired: false });
    expect(result.valid).toBe(true);
  });

  it('counts required-only progress for onboarding', () => {
    const counts = countAnsweredInDomain(
      'finance',
      { financialGoal: 'Save for a home' },
      { enforceRequired: true, countRequiredOnly: true },
    );
    expect(counts.total).toBe(0);
    expect(counts.answered).toBe(0);
  });

  it('detects wantKids relevance for conditional faith question', () => {
    expect(isWantKidsRelevantForLifeDomains("Don't want kids")).toBe(false);
    expect(isWantKidsRelevantForLifeDomains('Want kids')).toBe(true);
    expect(isWantKidsRelevantForLifeDomains('Undecided')).toBe(true);
    expect(isWantKidsRelevantForLifeDomains(null)).toBe(false);
  });

  it('moves the listed questions to essentials and out of life-domain lists', () => {
    const essentials = getEssentialsProfileQuestions();
    expect(essentials.map((row) => `${row.domainId}:${row.question.id}`)).toEqual([
      'intimacy:livingLocation',
      'intimacy:sexFrequency',
      'finance:yearlyIncome',
      'finance:financesPooled',
      'finance:debtAmount',
      'finance:debtPayoffPlan',
      'spirituality:raisingChildrenInFaith',
      'spirituality:spiritualPracticeWeeklyHours',
      'family:petStatus',
      'health:sleepSchedule',
    ]);
    expect(essentials.find((row) => row.question.id === 'raisingChildrenInFaith')?.question.input).toBe(
      'dropdown',
    );
    expect(essentials.find((row) => row.question.id === 'yearlyIncome')?.question.text).toBe(
      'What is your yearly income?',
    );

    for (const { domainId, question } of essentials) {
      expect(LIFE_DOMAIN_ONBOARDING_QUESTIONS[domainId].some((q) => q.id === question.id)).toBe(false);
    }
    expect(
      getActiveLifeDomainRequiredQuestionSteps('Want kids').map(
        (row) => `${row.domainId}:${row.questionId}`,
      ),
    ).toEqual([
      'finance:yearlyIncome',
      'finance:financesPooled',
      'finance:debtAmount',
      'finance:debtPayoffPlan',
      'family:petStatus',
      'intimacy:livingLocation',
      'intimacy:sexFrequency',
      'spirituality:raisingChildrenInFaith',
      'spirituality:spiritualPracticeWeeklyHours',
      'health:sleepSchedule',
    ]);
    expect(
      getActiveLifeDomainRequiredQuestionSteps("Don't want kids").some(
        (row) => row.questionId === 'raisingChildrenInFaith',
      ),
    ).toBe(false);
    expect(relocatedEssentialsQuestionResumeStep('lifeDomainQ__finance__yearlyIncome')).toBeNull();
  });

  it('orders optional open-ended domain steps after sliders', () => {
    expect(lifeDomainOptionalOpenEndedStepId('intimacy')).toBe('lifeDomainOptional__intimacy');
    const domainOrder = getActiveLifeDomainOptionalOpenEndedSteps('Want kids', {}).map(
      (row) => row.domainId,
    );
    expect(domainOrder).toEqual(['intimacy', 'finance', 'spirituality', 'family', 'health']);
  });

  it('includes optional dropdown follow-up questions in post-slider life-domain steps', () => {
    const familyOptionalIds = getLeftoverOptionalOpenEndedQuestionsForDomain('family', {}, {
      wantKids: 'Want kids',
    }).map((q) => q.id);
    expect(familyOptionalIds).toEqual(
      expect.arrayContaining([
        'kidsNumber',
        'kidsWhen',
        'adoptionPreferences',
        'childrenEducation',
      ]),
    );

    const healthOptionalIds = getLeftoverOptionalOpenEndedQuestionsForDomain('health', {}, {
      wantKids: 'Want kids',
    }).map((q) => q.id);
    expect(healthOptionalIds).toEqual(
      expect.arrayContaining(['diet', 'chronicIllnessStatus']),
    );
  });

  it('keeps all five optional open-ended domain steps in onboarding navigation', () => {
    const optionalIds = getLeftoverOptionalOpenEndedQuestionsForDomain('finance', {}, {
      wantKids: "Don't want kids",
    }).map((q) => q.id);
    const allAnswered = Object.fromEntries(optionalIds.map((id) => [id, 'filled']));
    const active = getActiveLifeDomainOptionalOpenEndedSteps("Don't want kids", {
      finance: allAnswered,
    }).map((row) => row.domainId);
    expect(active).toEqual(['intimacy', 'finance', 'spirituality', 'family', 'health']);
  });
});
