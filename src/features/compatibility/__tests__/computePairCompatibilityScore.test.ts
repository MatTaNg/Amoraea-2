import {
  computeConflictStyleAdjustment,
  computeFinalCompatibilityScore,
  computeFinanceAlignment,
  computePsychometricSoftAdjustments,
} from '../computeCompatibilityScore';
import { computePairCompatibilityScore } from '../computePairCompatibilityScore';
import { mapMatchmakingUserToCompatibilityInputs } from '../mapMatchmakingUserToCompatibilityInputs';
import {
  anxiousAvoidantUserA,
  anxiousAvoidantUserB,
  blockedKidsUserA,
  blockedKidsUserB,
  fixtureMappingExtras,
  idealPairUserA,
  idealPairUserB,
  lowCapacityUser,
  sparseDataUser,
} from './fixtures/matchmakingUserFixtures';

describe('computePairCompatibilityScore golden pipeline', () => {
  it('ideal pair scores high and is not hard-blocked', () => {
    const userA = mapMatchmakingUserToCompatibilityInputs(idealPairUserA, fixtureMappingExtras);
    const userB = mapMatchmakingUserToCompatibilityInputs(idealPairUserB, fixtureMappingExtras);
    const result = computePairCompatibilityScore(userA, userB);

    expect(result.subscores.dealbreakerMultiplier).toBe(1);
    expect(result.finalScore).toBeGreaterThan(0.7);
    expect(result.subscores.attachment).toBeGreaterThan(0.75);
    expect(result.breakdown.capacityDiscount).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(1);
  });

  it('kids mismatch hard-blocks to zero final score', () => {
    const userA = mapMatchmakingUserToCompatibilityInputs(blockedKidsUserA, fixtureMappingExtras);
    const userB = mapMatchmakingUserToCompatibilityInputs(blockedKidsUserB, fixtureMappingExtras);
    const result = computePairCompatibilityScore(userA, userB);

    expect(result.subscores.dealbreakerMultiplier).toBe(0);
    expect(result.finalScore).toBe(0);
  });

  it('sparse-data users still produce a valid bounded score', () => {
    const userA = mapMatchmakingUserToCompatibilityInputs(sparseDataUser);
    const userB = mapMatchmakingUserToCompatibilityInputs(sparseDataUser);
    const result = computePairCompatibilityScore(userA, userB);

    expect(result.finalScore).not.toBeNaN();
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(1);
    expect(result.subscores.dealbreakerMultiplier).toBe(1);
  });

  it('anxious-avoidant pair scores lower attachment than ideal pair', () => {
    const idealA = mapMatchmakingUserToCompatibilityInputs(idealPairUserA, fixtureMappingExtras);
    const idealB = mapMatchmakingUserToCompatibilityInputs(idealPairUserB, fixtureMappingExtras);
    const aaA = mapMatchmakingUserToCompatibilityInputs(anxiousAvoidantUserA, fixtureMappingExtras);
    const aaB = mapMatchmakingUserToCompatibilityInputs(anxiousAvoidantUserB, fixtureMappingExtras);

    const ideal = computePairCompatibilityScore(idealA, idealB);
    const anxiousAvoidant = computePairCompatibilityScore(aaA, aaB);

    expect(anxiousAvoidant.subscores.attachment).toBeLessThan(ideal.subscores.attachment);
    expect(anxiousAvoidant.finalScore).toBeLessThan(ideal.finalScore);
  });

  it('low capacity user increases capacity discount in pair with ideal partner', () => {
    const ideal = mapMatchmakingUserToCompatibilityInputs(idealPairUserA, fixtureMappingExtras);
    const low = mapMatchmakingUserToCompatibilityInputs(lowCapacityUser, fixtureMappingExtras);

    const balanced = computePairCompatibilityScore(ideal, ideal);
    const mismatched = computePairCompatibilityScore(ideal, low);

    expect(mismatched.breakdown.capacityDiscount).toBeGreaterThan(balanced.breakdown.capacityDiscount);
  });

  it('exposes breakdown components that sum consistently with final score logic', () => {
    const userA = mapMatchmakingUserToCompatibilityInputs(idealPairUserA, fixtureMappingExtras);
    const userB = mapMatchmakingUserToCompatibilityInputs(idealPairUserB, fixtureMappingExtras);
    const result = computePairCompatibilityScore(userA, userB);

    const core =
      result.breakdown.attachment +
      result.breakdown.values +
      result.breakdown.semantic +
      result.breakdown.finance +
      result.breakdown.interviewProcess +
      result.breakdown.baseline;

    const recomputed = Math.max(
      0,
      Math.min(1, core - result.breakdown.capacityDiscount + result.breakdown.adjustments),
    );
    expect(result.finalScore).toBeCloseTo(recomputed, 10);
  });
});

describe('computePairCompatibilityScore component edge cases', () => {
  it('computeFinanceAlignment uses 0.5 neutral fallbacks for missing fields', () => {
    expect(computeFinanceAlignment({}, {})).toBeCloseTo(0.5, 5);
  });

  it('computeConflictStyleAdjustment clamps to [-0.08, 0.03]', () => {
    const extreme = computeConflictStyleAdjustment(
      { competing: 100, collaborating: 0, compromising: 0, avoiding: 100, accommodating: 0 },
      { competing: 100, collaborating: 0, compromising: 0, avoiding: 100, accommodating: 0 },
      100,
    );
    expect(extreme).toBeGreaterThanOrEqual(-0.08);
    expect(extreme).toBeLessThanOrEqual(0.03);
  });

  it('computePsychometricSoftAdjustments ignores null NPI scores', () => {
    expect(
      computePsychometricSoftAdjustments(
        { npiEntitlementScore: null, dweckScore: null, scsSfScore: null },
        { npiEntitlementScore: null, dweckScore: null, scsSfScore: null },
      ),
    ).toBe(0);
  });

  it('computeFinalCompatibilityScore zeroes out when dealbreaker multiplier is 0', () => {
    const result = computeFinalCompatibilityScore({
      attachmentScore: 0.9,
      valuesScore: 0.9,
      semanticScore: 0.9,
      financeScore: 0.9,
      interviewProcessScore: 0.9,
      capacityA: 0.8,
      capacityB: 0.8,
      interviewWeightedScoreA: 8,
      interviewWeightedScoreB: 8,
      sexualCommAdjustment: 0.03,
      conflictStyleAdjustment: 0,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0,
      dealbreakerMultiplier: 0,
    });
    expect(result.finalScore).toBe(0);
  });
});
