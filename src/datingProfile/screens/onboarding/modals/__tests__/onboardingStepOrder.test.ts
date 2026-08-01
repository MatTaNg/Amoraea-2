import { describe, expect, it } from '@jest/globals';
import { getNextOnboardingStep } from '../onboardingStepNavigation';
import { ONBOARDING_STEPS_ORDER } from '../onboardingStepOrder';

describe('onboardingStepOrder', () => {
  it('places hobbies immediately after height & weight and dealbreaker after hobbies', () => {
    const heightWeightIdx = ONBOARDING_STEPS_ORDER.indexOf('heightWeight');
    const hobbiesIdx = ONBOARDING_STEPS_ORDER.indexOf('hobbies');
    const dealbreakerIdx = ONBOARDING_STEPS_ORDER.indexOf('hobbyDealbreaker');
    const workoutIdx = ONBOARDING_STEPS_ORDER.indexOf('workout');
    expect(hobbiesIdx).toBe(heightWeightIdx + 1);
    expect(dealbreakerIdx).toBe(hobbiesIdx + 1);
    expect(workoutIdx).toBe(dealbreakerIdx + 1);
  });

  it('places attraction immediately after name', () => {
    const nameIdx = ONBOARDING_STEPS_ORDER.indexOf('name');
    const attractionIdx = ONBOARDING_STEPS_ORDER.indexOf('attraction');
    expect(attractionIdx).toBe(nameIdx + 1);
  });

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

  it('places profile prompts before profile complete', () => {
    const promptsIdx = ONBOARDING_STEPS_ORDER.indexOf('profilePrompts');
    const completeIdx = ONBOARDING_STEPS_ORDER.indexOf('profileComplete');
    expect(promptsIdx).toBeGreaterThan(-1);
    expect(completeIdx).toBe(promptsIdx + 1);
  });

  it('advances from sexual focus to recent dating', () => {
    expect(getNextOnboardingStep('sexualFocus')).toBe('recentDatingEarlyWeeks');
  });

  it('advances from recent dating to first finance question', () => {
    expect(getNextOnboardingStep('recentDatingEarlyWeeks')).toBe('lifeDomainQ__finance__yearlyIncome');
  });
});
