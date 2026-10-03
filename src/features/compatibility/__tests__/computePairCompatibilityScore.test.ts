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
    expect(result.breakdown.capacityDiscount).toBe(0);
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

  it('does not apply a relational-capacity discount in ranking', () => {
    const ideal = mapMatchmakingUserToCompatibilityInputs(idealPairUserA, fixtureMappingExtras);
    const low = mapMatchmakingUserToCompatibilityInputs(lowCapacityUser, fixtureMappingExtras);

    const balanced = computePairCompatibilityScore(ideal, ideal);
    const mismatched = computePairCompatibilityScore(ideal, low);

    expect(balanced.breakdown.capacityDiscount).toBe(0);
    expect(mismatched.breakdown.capacityDiscount).toBe(0);
  });

  it('exposes breakdown components that sum consistently with final score logic', () => {
    const userA = mapMatchmakingUserToCompatibilityInputs(idealPairUserA, fixtureMappingExtras);
    const userB = mapMatchmakingUserToCompatibilityInputs(idealPairUserB, fixtureMappingExtras);
    const result = computePairCompatibilityScore(userA, userB);

    const core =
      result.breakdown.attachment +
      result.breakdown.values +
      result.breakdown.lifeDomain +
      result.breakdown.concreteLifeFit +
      result.breakdown.semantic +
      result.breakdown.finance +
      result.breakdown.interviewProcess +
      result.breakdown.baseline;

    expect(result.breakdown.interviewProcess).toBe(0);
    expect(result.breakdown.baseline).toBe(0);
    expect(result.breakdown.capacityDiscount).toBe(0);

    const recomputed = Math.max(
      0,
      Math.min(1, core + result.breakdown.adjustments),
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
      sexualCommAdjustment: 0,
      conflictStyleAdjustment: 0,
      politicsAdjustment: 0,
      psychometricSoftAdjustment: 0,
      dealbreakerMultiplier: 0,
    });
    expect(result.finalScore).toBe(0);
  });
});

describe('sexual communication is not a pair-ranking signal', () => {
  function pairWithMeans(meanA: number, meanB: number) {
    const userA = mapMatchmakingUserToCompatibilityInputs(idealPairUserA, fixtureMappingExtras);
    const userB = mapMatchmakingUserToCompatibilityInputs(idealPairUserB, fixtureMappingExtras);
    userA.sexualCommunicationMean = meanA;
    userB.sexualCommunicationMean = meanB;
    return computePairCompatibilityScore(userA, userB);
  }

  it('does not boost two similarly low scorers, two high scorers, or penalize a large mean gap', () => {
    const lowSimilar = pairWithMeans(2.0, 2.1);
    const highSimilar = pairWithMeans(4.8, 4.9);
    const farApart = pairWithMeans(2.0, 4.8);
    expect(lowSimilar.adjustments.sexualComm).toBe(0);
    expect(highSimilar.adjustments.sexualComm).toBe(0);
    expect(farApart.adjustments.sexualComm).toBe(0);
    expect(lowSimilar.finalScore).toBeCloseTo(highSimilar.finalScore, 10);
    expect(highSimilar.finalScore).toBeCloseTo(farApart.finalScore, 10);
    expect(lowSimilar.contributionBreakdown?.adjustments.sexualDiscrepancy).toBe(0);
  });

  it('does not copy a typology sexual-communication mean onto ranking inputs', () => {
    const mapped = mapMatchmakingUserToCompatibilityInputs(idealPairUserA, fixtureMappingExtras);
    expect(idealPairUserA.postInterviewTypology?.sexualCommunicationMean).toBe(4.0);
    expect(mapped.sexualCommunicationMean).toBeNull();
  });

  it('does not derive an intimacy domain score from sexual-communication similarity', () => {
    const result = pairWithMeans(2.0, 4.8);
    const intimacy = result.domainViews.find((d) => d.id === 'intimacy');
    expect(intimacy?.score).toBeNull();
    expect(intimacy?.band).toBe('Unavailable');
    expect(intimacy?.explanation).toMatch(/preferences and needs/i);
  });
});
