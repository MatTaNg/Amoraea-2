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

  it('places more-about-you questions after recent dating and before space for a new relationship', () => {
    const recentDatingIdx = ONBOARDING_STEPS_ORDER.indexOf('recentDatingEarlyWeeks');
    const incomeIdx = ONBOARDING_STEPS_ORDER.indexOf('lifeDomainQ__finance__yearlyIncome');
    const sleepIdx = ONBOARDING_STEPS_ORDER.indexOf('lifeDomainQ__health__sleepSchedule');
    const spaceIdx = ONBOARDING_STEPS_ORDER.indexOf('spaceForNewRelationship');
    const matchPrefsIdx = ONBOARDING_STEPS_ORDER.indexOf('matchPreferences');
    const lifeDomainsIdx = ONBOARDING_STEPS_ORDER.indexOf('lifeDomains');

    expect(incomeIdx).toBe(recentDatingIdx + 1);
    expect(sleepIdx).toBeGreaterThan(incomeIdx);
    expect(spaceIdx).toBe(sleepIdx + 1);
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

  it('advances from recent dating into the more-about-you questions', () => {
    expect(getNextOnboardingStep('recentDatingEarlyWeeks')).toBe('lifeDomainQ__finance__yearlyIncome');
  });

  it('advances from sleep schedule to space for a new relationship', () => {
    expect(getNextOnboardingStep('lifeDomainQ__health__sleepSchedule')).toBe('spaceForNewRelationship');
  });
});
