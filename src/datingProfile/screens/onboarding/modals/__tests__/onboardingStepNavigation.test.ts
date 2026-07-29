import { getLeftoverOptionalOpenEndedQuestionsForDomain } from '@/shared/constants/lifeDomainOnboardingQuestions';
import {
  getEffectiveOnboardingStepsOrder,
  getPrevOnboardingStep,
  resolveRestoredOnboardingStep,
} from '../onboardingStepNavigation';

describe('onboardingStepNavigation', () => {
  it('always includes all optional life-domain follow-up steps in effective order', () => {
    const intimacyOptionalIds = getLeftoverOptionalOpenEndedQuestionsForDomain('intimacy', {}, {
      wantKids: 'Want kids',
    }).map((q) => q.id);
    const allIntimacyAnswered = Object.fromEntries(
      intimacyOptionalIds.map((id) => [id, 'filled']),
    );
    const ctx = {
      wantKids: 'Want kids',
      lifeDomainAnswers: {
        intimacy: allIntimacyAnswered,
      },
    };

    const steps = getEffectiveOnboardingStepsOrder(ctx);
    expect(steps).toContain('lifeDomainOptional__intimacy');
    expect(steps).toContain('lifeDomainOptional__finance');
  });

  it('backs from finance optional to intimacy even when intimacy optional answers are complete', () => {
    const intimacyOptionalIds = getLeftoverOptionalOpenEndedQuestionsForDomain('intimacy', {}, {
      wantKids: 'Want kids',
    }).map((q) => q.id);
    const allIntimacyAnswered = Object.fromEntries(
      intimacyOptionalIds.map((id) => [id, 'filled']),
    );
    const ctx = {
      wantKids: 'Want kids',
      lifeDomainAnswers: {
        intimacy: allIntimacyAnswered,
      },
    };

    expect(getPrevOnboardingStep('lifeDomainOptional__finance', ctx)).toBe(
      'lifeDomainOptional__intimacy',
    );
  });

  it('backs from finance optional to intimacy optional when intimacy still has unanswered follow-ups', () => {
    const ctx = { wantKids: 'Want kids', lifeDomainAnswers: {} };

    expect(getPrevOnboardingStep('lifeDomainOptional__finance', ctx)).toBe(
      'lifeDomainOptional__intimacy',
    );
  });

  it('resolves stale optional steps to the nearest active step', () => {
    const intimacyOptionalIds = getLeftoverOptionalOpenEndedQuestionsForDomain('intimacy', {}, {
      wantKids: 'Want kids',
    }).map((q) => q.id);
    const allIntimacyAnswered = Object.fromEntries(
      intimacyOptionalIds.map((id) => [id, 'filled']),
    );
    const ctx = {
      wantKids: 'Want kids',
      lifeDomainAnswers: {
        intimacy: allIntimacyAnswered,
      },
    };

    expect(resolveRestoredOnboardingStep('lifeDomainOptional__intimacy', ctx)).toBe(
      'lifeDomainOptional__intimacy',
    );
  });
});
