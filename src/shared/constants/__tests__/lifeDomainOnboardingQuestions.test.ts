import { describe, expect, it } from '@jest/globals';
import {
  countAnsweredInDomain,
  findLifeDomainQuestionDef,
  getActiveLifeDomainOptionalOpenEndedSteps,
  getActiveLifeDomainRequiredQuestionSteps,
  getLeftoverOptionalOpenEndedQuestionsForDomain,
  isWantKidsRelevantForLifeDomains,
  lifeDomainOptionalOpenEndedStepId,
  lifeDomainQuestionStepId,
  validateLifeDomainStep,
} from '../lifeDomainOnboardingQuestions';

describe('lifeDomainOnboardingQuestions validation', () => {
  it('requires finance dropdown fields during onboarding', () => {
    const result = validateLifeDomainStep(
      'finance',
      { yearlyIncome: 'Under $25,000' },
      { enforceRequired: true },
    );
    expect(result.valid).toBe(false);
    expect(result.missingQuestions.map((q) => q.id)).toEqual(
      expect.arrayContaining(['debtAmount', 'debtPayoffPlan', 'financesPooled']),
    );
  });

  it('requires intimacy livingLocation and sexFrequency', () => {
    const result = validateLifeDomainStep(
      'intimacy',
      { livingLocation: 'City' },
      { enforceRequired: true },
    );
    expect(result.valid).toBe(false);
    expect(result.missingQuestions.some((q) => q.id === 'sexFrequency')).toBe(true);
  });

  it('requires spiritualPracticeWeeklyHours always on spirituality step', () => {
    const missingFaith = validateLifeDomainStep(
      'spirituality',
      {},
      { enforceRequired: true, wantKids: "Don't want kids" },
    );
    expect(missingFaith.missingQuestions.map((q) => q.id)).toContain('spiritualPracticeWeeklyHours');
    expect(missingFaith.missingQuestions.some((q) => q.id === 'raisingChildrenInFaith')).toBe(false);

    const wantsKids = validateLifeDomainStep(
      'spirituality',
      { spiritualPracticeWeeklyHours: '1–3 hours' },
      { enforceRequired: true, wantKids: 'Want kids' },
    );
    expect(wantsKids.valid).toBe(false);
    expect(wantsKids.missingQuestions.some((q) => q.id === 'raisingChildrenInFaith')).toBe(true);
  });

  it('requires petStatus on family step', () => {
    const result = validateLifeDomainStep('family', {}, { enforceRequired: true });
    expect(result.missingQuestions.some((q) => q.id === 'petStatus')).toBe(true);
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
      {
        yearlyIncome: 'Under $25,000',
        debtAmount: 'None',
      },
      { enforceRequired: true, countRequiredOnly: true },
    );
    expect(counts.answered).toBe(2);
    expect(counts.total).toBe(4);
  });

  it('detects wantKids relevance for conditional faith question', () => {
    expect(isWantKidsRelevantForLifeDomains("Don't want kids")).toBe(false);
    expect(isWantKidsRelevantForLifeDomains('Want kids')).toBe(true);
    expect(isWantKidsRelevantForLifeDomains('Undecided')).toBe(true);
    expect(isWantKidsRelevantForLifeDomains(null)).toBe(false);
  });

  it('exposes one onboarding step per required finance question', () => {
    const steps = getActiveLifeDomainRequiredQuestionSteps("Don't want kids")
      .filter((row) => row.domainId === 'finance')
      .map((row) => row.questionId);
    expect(steps).toEqual(['yearlyIncome', 'financesPooled', 'debtAmount', 'debtPayoffPlan']);
    expect(lifeDomainQuestionStepId('finance', 'yearlyIncome')).toBe(
      'lifeDomainQ__finance__yearlyIncome',
    );
  });

  it('maps raisingChildrenInFaith to a dropdown in spirituality', () => {
    const def = findLifeDomainQuestionDef('spirituality', 'raisingChildrenInFaith');
    expect(def?.input).toBe('dropdown');
    expect(def?.options?.some((o) => o.value === 'Very important')).toBe(true);
  });

  it('includes raisingChildrenInFaith step only when user wants kids', () => {
    const noKids = getActiveLifeDomainRequiredQuestionSteps("Don't want kids").map(
      (row) => row.questionId,
    );
    expect(noKids).not.toContain('raisingChildrenInFaith');
    const wantsKids = getActiveLifeDomainRequiredQuestionSteps('Want kids').map(
      (row) => row.questionId,
    );
    expect(wantsKids).toContain('raisingChildrenInFaith');
  });

  it('keeps compatibility questions in the required-question step list', () => {
    const noKids = getActiveLifeDomainRequiredQuestionSteps("Don't want kids");
    const noKidsIds = noKids.map((row) => `${row.domainId}:${row.questionId}`);
    expect(noKidsIds).toEqual(
      expect.arrayContaining([
        'intimacy:livingLocation',
        'intimacy:sexFrequency',
        'finance:yearlyIncome',
        'finance:financesPooled',
        'finance:debtAmount',
        'finance:debtPayoffPlan',
        'spirituality:spiritualPracticeWeeklyHours',
        'family:petStatus',
        'health:sleepSchedule',
      ]),
    );

    const wantsKids = getActiveLifeDomainRequiredQuestionSteps('Want kids');
    const wantsKidsIds = wantsKids.map(
      (row) => `${row.domainId}:${row.questionId}`,
    );
    expect(wantsKidsIds).toEqual(
      expect.arrayContaining(['spirituality:raisingChildrenInFaith']),
    );
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

  it('skips optional open-ended steps when no unanswered optional text remains', () => {
    const optionalIds = getLeftoverOptionalOpenEndedQuestionsForDomain('finance', {}, {
      wantKids: "Don't want kids",
    }).map((q) => q.id);
    const allAnswered = Object.fromEntries(optionalIds.map((id) => [id, 'filled']));
    const active = getActiveLifeDomainOptionalOpenEndedSteps("Don't want kids", {
      finance: allAnswered,
    }).map((row) => row.domainId);
    expect(active).not.toContain('finance');
    expect(active.length).toBeGreaterThan(0);
  });
});
