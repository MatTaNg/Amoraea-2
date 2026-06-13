import { describe, expect, it } from '@jest/globals';
import { getNextOnboardingStep } from '../onboardingStepNavigation';
import { ONBOARDING_STEPS_ORDER } from '../onboardingStepOrder';

describe('onboardingStepOrder', () => {
  it('places life-domain required questions before space and lifestyle dealbreakers', () => {
    const yearlyIncomeIdx = ONBOARDING_STEPS_ORDER.indexOf('lifeDomainQ__finance__yearlyIncome');
    const sleepScheduleIdx = ONBOARDING_STEPS_ORDER.indexOf('lifeDomainQ__health__sleepSchedule');
    const recentDatingIdx = ONBOARDING_STEPS_ORDER.indexOf('recentDatingEarlyWeeks');
    const spaceIdx = ONBOARDING_STEPS_ORDER.indexOf('spaceForNewRelationship');
    const matchPrefsIdx = ONBOARDING_STEPS_ORDER.indexOf('matchPreferences');
    const lifeDomainsIdx = ONBOARDING_STEPS_ORDER.indexOf('lifeDomains');

    expect(yearlyIncomeIdx).toBeGreaterThan(recentDatingIdx);
    expect(sleepScheduleIdx).toBeGreaterThan(yearlyIncomeIdx);
    expect(spaceIdx).toBeGreaterThan(sleepScheduleIdx);
    expect(matchPrefsIdx).toBeGreaterThan(spaceIdx);
    expect(lifeDomainsIdx).toBeGreaterThan(matchPrefsIdx);
  });

  it('advances from recent dating to first finance question', () => {
    expect(getNextOnboardingStep('recentDatingEarlyWeeks')).toBe('lifeDomainQ__finance__yearlyIncome');
  });
});
