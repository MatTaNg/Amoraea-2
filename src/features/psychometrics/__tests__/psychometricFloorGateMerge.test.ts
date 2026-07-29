import { describe, expect, it } from '@jest/globals';
import { GATE_PASS_WEIGHTED_MIN } from '@features/aria/computeGateResultCore';
import { normalizeGateFailDetailForPersist } from '../gateFailDetailForPersist';
import {
  ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES,
  AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE,
  AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_THRESHOLD,
  ANXIETY_TRAIT_HIGH_FLOOR_CODE,
  ANXIETY_TRAIT_HIGH_FLOOR_THRESHOLD,
  BRS_LOW_RESILIENCE_FLOOR_THRESHOLD,
  BRS_LOW_RESILIENCE_FLOOR_CODE,
  DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE,
  DWECK_EXTREME_FIXED_MINDSET_FLOOR_THRESHOLD,
  GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE,
  GASP_EXTREME_EXTERNALIZATION_FLOOR_THRESHOLD,
  GASP_STRAIGHT_LINE_FLAG,
  collectPsychometricFloorGateFailReasons,
  collectPsychometricFloorUncertaintyFlags,
  mergeInterviewGateFailReasonsPreservingPsychometricFloors,
  mergePsychometricFloorsIntoGateState,
  normalizePsychometricFloorsGateDetail,
  RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
  RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_THRESHOLD,
  RSES_LOW_SELF_ESTEEM_FLOOR_CODE,
  RSES_LOW_SELF_ESTEEM_FLOOR_THRESHOLD,
  SCS_LOW_PRIVATE_SELF_AWARENESS_FLOOR_CODE,
  SCS_PRIVATE_LOW_SELF_AWARENESS_FLOOR_THRESHOLD,
  SCS_PUBLIC_HIGH_SELF_CONSCIOUSNESS_FLOOR_THRESHOLD,
  SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE,
  SCS_SF_LOW_SELF_COMPASSION_FLOOR_THRESHOLD,
} from '../psychometricFloorBreaches';
import { SD3_NARCISSISM_FLOOR_THRESHOLD } from '../sd3NarcissismFloor';
import { NPI_ENTITLEMENT_FLOOR_THRESHOLD } from '../npiEntitlementFloor';
import { computePsychometricModifier } from '../computePsychometricModifier';
import { NPI_ENTITLEMENT_ENABLED } from '../interviewCompletionStatus';
import {
  ACTIVE_NARCISSISM_FLOOR_CODE,
  NARCISSISM_PSYCHOMETRIC_GATE_FLOOR_ENABLED,
  narcissismFloorBreachScores,
} from '../narcissismInstrumentTestFixtures';

const SD3_NARCISSISM_FLOOR_FAIL_CODE = 'sd3_narcissism_floor';

const MODERATE_RANDOM_FLOOR_SCORES = {
  brsScore: 3.0,
  anxietyTraitScore: 3.0,
  scsSfScore: 2.917,
  gaspScore: 3.0,
  dweckScore: 3.7,
  aaq2Score: 28,
  rsesScore: 26,
  scsPublicScore: 13,
  scsPrivateScore: 10,
  rfqScore: 3.875,
  ...narcissismFloorBreachScores(false),
};

const HEALTHY_FLOOR_SCORES = {
  rfqScore: 4,
  gaspScore: 3,
  dweckScore: 4,
  scsSfScore: 4,
  ...narcissismFloorBreachScores(false),
  brsScore: 3.5,
  aaq2Score: 20,
  rsesScore: 28,
  scsPublicScore: 12,
  scsPrivateScore: 14,
};

const REGRESSION_FLOOR_SCORES = {
  rfqScore: 1.75,
  gaspScore: 4.75,
  dweckScore: 2.3,
  scsSfScore: 2.417,
  ...narcissismFloorBreachScores(true),
  brsScore: 1.667,
  anxietyTraitScore: null,
  aaq2Score: 34,
  rsesScore: 20,
  scsPublicScore: 18,
  scsPrivateScore: 9,
};

describe('psychometric floor gate merge', () => {
  it('uncertainty flags and gate_fail_reasons use the same instrument floor detection', () => {
    const scores = {
      rfqScore: 1.8,
      gaspScore: 4.75,
      dweckScore: 2.3,
      scsSfScore: 2.417,
      ...narcissismFloorBreachScores(true),
      brsScore: 1.667,
      anxietyTraitScore: null,
      aaq2Score: 34,
      rsesScore: 22,
      scsPublicScore: 18,
      scsPrivateScore: 9,
    };
    const straightLineFlags: string[] = [];
    expect(collectPsychometricFloorUncertaintyFlags(scores, straightLineFlags)).toEqual(
      collectPsychometricFloorGateFailReasons(scores, straightLineFlags),
    );
  });

  it('mergePsychometricFloorsIntoGateState adds GASP and Dweck floors and fails final gate', () => {
    const merged = mergePsychometricFloorsIntoGateState({
      existingFailReasons: ['weighted_score'],
      existingDetail: { weighted_score: { score: 7.2, requiredMin: GATE_PASS_WEIGHTED_MIN } },
      scores: {
        ...HEALTHY_FLOOR_SCORES,
        gaspScore: 4.75,
        dweckScore: 2.3,
      },
      straightLineFlags: [],
    });
    expect(merged.gateFailReasons).toContain(GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE);
    expect(merged.gateFailReasons).toContain(DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE);
    expect(merged.gateFailReasons).toContain('weighted_score');
    const psychFloors = merged.gateFailDetail.psychometric_floors as Record<
      string,
      { score: number; description: string }
    >;
    expect(psychFloors[GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE]?.score).toBe(4.75);
    expect(psychFloors[DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE]?.score).toBe(2.3);
    expect(psychFloors[GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE]?.description).toContain('4.6');
  });

  it('mergePsychometricFloorsIntoGateState adds active narcissism floor with keyed detail', () => {
    const merged = mergePsychometricFloorsIntoGateState({
      existingFailReasons: [],
      existingDetail: null,
      scores: {
        ...HEALTHY_FLOOR_SCORES,
        ...narcissismFloorBreachScores(true),
        ...(NPI_ENTITLEMENT_ENABLED ? { npiEntitlementScore: 6 } : { sd3NarcissismScore: 4.889 }),
      },
      straightLineFlags: [],
    });
    if (!NARCISSISM_PSYCHOMETRIC_GATE_FLOOR_ENABLED) {
      expect(merged.gateFailReasons).not.toContain(ACTIVE_NARCISSISM_FLOOR_CODE);
      return;
    }
    expect(merged.gateFailReasons).toContain(ACTIVE_NARCISSISM_FLOOR_CODE);
    const psychFloors = merged.gateFailDetail.psychometric_floors as Record<
      string,
      { score: number; description: string }
    >;
    if (NPI_ENTITLEMENT_ENABLED) {
      expect(psychFloors[ACTIVE_NARCISSISM_FLOOR_CODE]?.score).toBe(6);
      expect(psychFloors[ACTIVE_NARCISSISM_FLOOR_CODE]?.description).toContain('NPI Entitlement');
    } else {
      expect(psychFloors[ACTIVE_NARCISSISM_FLOOR_CODE]?.score).toBeCloseTo(4.889);
      expect(psychFloors[ACTIVE_NARCISSISM_FLOOR_CODE]?.description).toContain('SD3 narcissism');
    }
  });

  it('adds instrument floors when straight-line flag is present but score breaches threshold', () => {
    const merged = mergePsychometricFloorsIntoGateState({
      existingFailReasons: [],
      existingDetail: null,
      scores: { ...HEALTHY_FLOOR_SCORES, gaspScore: 5.7 },
      straightLineFlags: [GASP_STRAIGHT_LINE_FLAG],
    });
    expect(merged.gateFailReasons).toContain(GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE);
  });

  it('preserves psychometric floors when interview gate overwrites fail reasons', () => {
    const preserved = mergeInterviewGateFailReasonsPreservingPsychometricFloors(
      ['weighted_score'],
      [GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE, DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE],
    );
    expect(preserved).toEqual(
      expect.arrayContaining([
        'weighted_score',
        GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE,
        DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE,
      ]),
    );
  });

  it('computePsychometricModifier floors match collectPsychometricFloorGateFailReasons', () => {
    const scores = {
      brsScore: 4,
      anxietyTraitScore: 3,
      scsSfScore: 4,
      gaspScore: 4.75,
      dweckScore: 2.3,
      aaq2Score: 44,
      rsesScore: 10,
      scsPublicScore: 10,
      scsPrivateScore: 10,
      mspssFriendsScore: 5,
      mspssFamilyScore: 5,
      ...narcissismFloorBreachScores(false),
      rfqScore: 4,
    };
    const result = computePsychometricModifier({
      ...scores,
      npiEntitlementScore: NPI_ENTITLEMENT_ENABLED ? 2 : null,
      sd3NarcissismScore: NPI_ENTITLEMENT_ENABLED ? null : scores.sd3NarcissismScore ?? 2,
    });
    const expected = collectPsychometricFloorGateFailReasons(
      {
        rfqScore: scores.rfqScore,
        gaspScore: scores.gaspScore,
        dweckScore: scores.dweckScore,
        scsSfScore: scores.scsSfScore,
        sd3NarcissismScore: NPI_ENTITLEMENT_ENABLED ? null : 2,
        npiEntitlementScore: NPI_ENTITLEMENT_ENABLED ? 2 : null,
        brsScore: scores.brsScore,
        anxietyTraitScore: scores.anxietyTraitScore,
        aaq2Score: scores.aaq2Score,
        rsesScore: scores.rsesScore,
        scsPublicScore: scores.scsPublicScore,
        scsPrivateScore: scores.scsPrivateScore,
      },
      result.straightLineFlags,
    );
    expect(result.psychometricFloorBreaches.sort()).toEqual(expected.sort());
    expect(result.psychometricFloorBreaches).toContain(RSES_LOW_SELF_ESTEEM_FLOOR_CODE);
    expect(result.psychometricFloorBreaches).toContain(AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE);
  });

  it('ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES includes new instrument floors', () => {
    expect(ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES).toContain(RSES_LOW_SELF_ESTEEM_FLOOR_CODE);
    expect(ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES).toContain(AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE);
    expect(ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES).toContain(BRS_LOW_RESILIENCE_FLOOR_CODE);
    expect(ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES).not.toContain(SCS_LOW_PRIVATE_SELF_AWARENESS_FLOOR_CODE);
    expect(ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES).toContain(ANXIETY_TRAIT_HIGH_FLOOR_CODE);
  });

  it('normalizePsychometricFloorsGateDetail rebuilds keyed detail from legacy string[]', () => {
    const normalized = normalizePsychometricFloorsGateDetail(
      [RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE, GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE],
      {
        rfqScore: 1.625,
        gaspScore: 4.75,
        dweckScore: 4,
        scsSfScore: 4,
        sd3NarcissismScore: 2,
        npiEntitlementScore: NPI_ENTITLEMENT_ENABLED ? 2 : null,
        brsScore: 4,
        anxietyTraitScore: 2.5,
        aaq2Score: 20,
        rsesScore: 28,
        scsPublicScore: 12,
        scsPrivateScore: 14,
      },
    );
    expect(Array.isArray(normalized)).toBe(false);
    expect(normalized[RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE]?.score).toBe(1.625);
    expect(normalized[GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE]?.description).toContain('4.6');
  });

  it('mergePsychometricFloorsIntoGateState never persists array psychometric_floors from prior detail', () => {
    const merged = mergePsychometricFloorsIntoGateState({
      existingFailReasons: ['weighted_score'],
      existingDetail: {
        weighted_score: { score: 7.2, requiredMin: GATE_PASS_WEIGHTED_MIN },
        psychometric_floors: [
          RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
          GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE,
        ],
      },
      scores: {
        rfqScore: 1.625,
        gaspScore: 4.75,
        dweckScore: 4,
        scsSfScore: 4,
        sd3NarcissismScore: 2,
        npiEntitlementScore: NPI_ENTITLEMENT_ENABLED ? 2 : null,
        brsScore: 4,
        anxietyTraitScore: 2.5,
        aaq2Score: 20,
        rsesScore: 28,
        scsPublicScore: 12,
        scsPrivateScore: 14,
      },
      straightLineFlags: [],
    });
    const psychFloors = merged.gateFailDetail.psychometric_floors as Record<
      string,
      { score: number; description: string }
    >;
    expect(Array.isArray(psychFloors)).toBe(false);
    expect(psychFloors[RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE]?.score).toBe(1.625);
    expect(psychFloors[GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE]?.description).toContain('4.6');
  });

  it('mergePsychometricFloorsIntoGateState produces rich detail for all triggered floors', () => {
    const merged = mergePsychometricFloorsIntoGateState({
      existingFailReasons: [],
      existingDetail: null,
      scores: REGRESSION_FLOOR_SCORES,
      straightLineFlags: [],
    });
    const psychFloors = merged.gateFailDetail.psychometric_floors as Record<
      string,
      { score: number; description: string }
    >;
    for (const floorId of merged.gateFailReasons.filter((id) =>
      (ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES as readonly string[]).includes(id),
    )) {
      expect(psychFloors[floorId]?.score).toEqual(expect.any(Number));
      expect(psychFloors[floorId]?.description).toEqual(expect.any(String));
    }
  });

  it('triggers all eight active instrument floors for the regression user profile', () => {
    const breaches = collectPsychometricFloorGateFailReasons(REGRESSION_FLOOR_SCORES, []);
    expect(breaches).toEqual(
      expect.arrayContaining([
        RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
        GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE,
        DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE,
        SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE,
        BRS_LOW_RESILIENCE_FLOOR_CODE,
        AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE,
        RSES_LOW_SELF_ESTEEM_FLOOR_CODE,
        ...(NARCISSISM_PSYCHOMETRIC_GATE_FLOOR_ENABLED ? [ACTIVE_NARCISSISM_FLOOR_CODE] : []),
      ]),
    );
    expect(breaches).toHaveLength(NARCISSISM_PSYCHOMETRIC_GATE_FLOOR_ENABLED ? 8 : 7);
  });

  it('does not trigger any floors at healthy moderate scores', () => {
    const breaches = collectPsychometricFloorGateFailReasons(HEALTHY_FLOOR_SCORES, []);
    expect(breaches).toHaveLength(0);
  });

  it('does not trigger any floors at moderate random psychometric profile', () => {
    const breaches = collectPsychometricFloorGateFailReasons(MODERATE_RANDOM_FLOOR_SCORES, []);
    expect(breaches).toHaveLength(0);
  });

  it('drops stale psychometric floor codes when re-evaluating with moderate scores', () => {
    const merged = mergePsychometricFloorsIntoGateState({
      existingFailReasons: [
        'weighted_score',
        RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
        BRS_LOW_RESILIENCE_FLOOR_CODE,
        ACTIVE_NARCISSISM_FLOOR_CODE,
      ],
      existingDetail: normalizeGateFailDetailForPersist({
        psychometric_floors: {
          [RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE]: { score: 1.5, description: 'stale' },
        },
      }),
      scores: MODERATE_RANDOM_FLOOR_SCORES,
      straightLineFlags: [],
    });
    expect(merged.gateFailReasons).toEqual(['weighted_score']);
    expect(merged.gateFailDetail.psychometric_floors).toEqual({});
  });

  it('triggers anxiety_trait_high_floor at score 5.0 with gate_fail_detail', () => {
    const merged = mergePsychometricFloorsIntoGateState({
      existingFailReasons: [],
      existingDetail: null,
      scores: { ...HEALTHY_FLOOR_SCORES, anxietyTraitScore: 5.0 },
      straightLineFlags: [],
    });
    expect(merged.gateFailReasons).toContain(ANXIETY_TRAIT_HIGH_FLOOR_CODE);
    const psychFloors = merged.gateFailDetail.psychometric_floors as Record<
      string,
      { score: number; description: string }
    >;
    expect(psychFloors[ANXIETY_TRAIT_HIGH_FLOOR_CODE]?.score).toBe(5);
    expect(psychFloors[ANXIETY_TRAIT_HIGH_FLOOR_CODE]?.description).toContain('4.9');
    expect(psychFloors[ANXIETY_TRAIT_HIGH_FLOOR_CODE]?.description).toContain(
      'near-maximum chronic trait anxiety',
    );
  });

  it('does not trigger anxiety_trait_high_floor at score 4.0', () => {
    const breaches = collectPsychometricFloorGateFailReasons(
      { ...HEALTHY_FLOOR_SCORES, anxietyTraitScore: 4.0 },
      [],
    );
    expect(breaches).not.toContain(ANXIETY_TRAIT_HIGH_FLOOR_CODE);
  });

  it('triggers anxiety_trait_high_floor when straight-line flag is present but score breaches threshold', () => {
    const breaches = collectPsychometricFloorGateFailReasons(
      { ...HEALTHY_FLOOR_SCORES, anxietyTraitScore: 5.0 },
      ['anxiety_trait_straight_line'],
    );
    expect(breaches).toContain(ANXIETY_TRAIT_HIGH_FLOOR_CODE);
  });

  it('fires floors based on score alone regardless of straight-line flags', () => {
    const straightLineCases: Array<{
      scores: typeof HEALTHY_FLOOR_SCORES;
      straightLineFlags: string[];
      expectedFloor: string;
    }> = [
      {
        scores: { ...HEALTHY_FLOOR_SCORES, aaq2Score: 37 },
        straightLineFlags: ['aaq2_straight_line'],
        expectedFloor: AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE,
      },
      {
        scores: { ...HEALTHY_FLOOR_SCORES, rsesScore: 13 },
        straightLineFlags: ['rses_straight_line'],
        expectedFloor: RSES_LOW_SELF_ESTEEM_FLOOR_CODE,
      },
      ...(NARCISSISM_PSYCHOMETRIC_GATE_FLOOR_ENABLED
        ? [
            {
              scores: {
                ...HEALTHY_FLOOR_SCORES,
                sd3NarcissismScore: 4.5,
                npiEntitlementScore: null,
              },
              straightLineFlags: ['sd3_narcissism_straight_line'],
              expectedFloor: ACTIVE_NARCISSISM_FLOOR_CODE,
            },
          ]
        : []),
      {
        scores: { ...HEALTHY_FLOOR_SCORES, brsScore: 1.5 },
        straightLineFlags: ['brs_straight_line'],
        expectedFloor: BRS_LOW_RESILIENCE_FLOOR_CODE,
      },
    ];

    for (const { scores, straightLineFlags, expectedFloor } of straightLineCases) {
      const breaches = collectPsychometricFloorGateFailReasons(scores, straightLineFlags);
      expect(breaches).toContain(expectedFloor);
    }

    const belowThreshold = collectPsychometricFloorGateFailReasons(
      { ...HEALTHY_FLOOR_SCORES, aaq2Score: 15 },
      ['aaq2_straight_line'],
    );
    expect(belowThreshold).not.toContain(AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE);
  });

  it('preserves all existing floor thresholds unchanged', () => {
    expect(RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_THRESHOLD).toBe(2.0);
    expect(GASP_EXTREME_EXTERNALIZATION_FLOOR_THRESHOLD).toBe(4.6);
    expect(DWECK_EXTREME_FIXED_MINDSET_FLOOR_THRESHOLD).toBe(2.4);
    expect(SCS_SF_LOW_SELF_COMPASSION_FLOOR_THRESHOLD).toBe(2.5);
    expect(BRS_LOW_RESILIENCE_FLOOR_THRESHOLD).toBe(1.8);
    expect(AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_THRESHOLD).toBe(33);
    expect(RSES_LOW_SELF_ESTEEM_FLOOR_THRESHOLD).toBe(20);
    expect(SCS_PUBLIC_HIGH_SELF_CONSCIOUSNESS_FLOOR_THRESHOLD).toBe(17);
    expect(SCS_PRIVATE_LOW_SELF_AWARENESS_FLOOR_THRESHOLD).toBe(10);
    if (NPI_ENTITLEMENT_ENABLED) {
      expect(NPI_ENTITLEMENT_FLOOR_THRESHOLD).toBe(5);
    } else {
      expect(SD3_NARCISSISM_FLOOR_THRESHOLD).toBe(4.0);
    }
    expect(ANXIETY_TRAIT_HIGH_FLOOR_THRESHOLD).toBe(4.9);
  });
});
