import { describe, expect, it } from '@jest/globals';
import { GATE_PASS_WEIGHTED_MIN } from '@features/aria/computeGateResultCore';
import {
  ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES,
  DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE,
  GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE,
  GASP_STRAIGHT_LINE_FLAG,
  HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE,
  LOW_SELF_ESTEEM_FLOOR_CODE,
  collectPsychometricFloorGateFailReasons,
  collectPsychometricFloorUncertaintyFlags,
  mergeInterviewGateFailReasonsPreservingPsychometricFloors,
  mergePsychometricFloorsIntoGateState,
  normalizePsychometricFloorsGateDetail,
  RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
  SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE,
} from '../psychometricFloorBreaches';
import { computePsychometricModifier } from '../computePsychometricModifier';

const SD3_NARCISSISM_FLOOR_FAIL_CODE = 'sd3_narcissism_floor';

const BASE_SCORES = {
  brsScore: 4,
  scsSfScore: 4,
  gaspScore: 3,
  dweckScore: 4,
  aaq2Score: 20,
  rsesScore: 25,
  scsPublicScore: 4,
  scsPrivateScore: 4,
  mspssFriendsScore: 5,
  mspssFamilyScore: 5,
  sd3NarcissismScore: 2,
  rfqScore: 4,
};

describe('psychometric floor gate merge', () => {
  it('uncertainty flags and gate_fail_reasons use the same instrument floor detection', () => {
    const scores = {
      rfqScore: 1.8,
      gaspScore: 5.7,
      dweckScore: 1.8,
      scsSfScore: 1.3,
      sd3NarcissismScore: 4.2,
    };
    const straightLineFlags: string[] = [];
    expect(collectPsychometricFloorUncertaintyFlags(scores, straightLineFlags)).toEqual(
      collectPsychometricFloorGateFailReasons(scores, straightLineFlags, {
        aaq2Score: null,
        rsesScore: null,
      }),
    );
  });

  it('mergePsychometricFloorsIntoGateState adds GASP and Dweck floors and fails final gate', () => {
    const merged = mergePsychometricFloorsIntoGateState({
      existingFailReasons: ['weighted_score'],
      existingDetail: { weighted_score: { score: 7.2, requiredMin: GATE_PASS_WEIGHTED_MIN } },
      scores: {
        rfqScore: 4,
        gaspScore: 5.7,
        dweckScore: 1.8,
        scsSfScore: 4,
        sd3NarcissismScore: 2,
      },
      straightLineFlags: [],
      aaq2Score: 20,
      rsesScore: 25,
    });
    expect(merged.gateFailReasons).toContain(GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE);
    expect(merged.gateFailReasons).toContain(DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE);
    expect(merged.gateFailReasons).toContain('weighted_score');
    const psychFloors = merged.gateFailDetail.psychometric_floors as Record<
      string,
      { score: number; description: string }
    >;
    expect(psychFloors[GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE]?.score).toBe(5.7);
    expect(psychFloors[DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE]?.score).toBe(1.8);
  });

  it('mergePsychometricFloorsIntoGateState adds SD3 narcissism floor with keyed detail', () => {
    const merged = mergePsychometricFloorsIntoGateState({
      existingFailReasons: [],
      existingDetail: null,
      scores: {
        rfqScore: 4,
        gaspScore: 3,
        dweckScore: 4,
        scsSfScore: 4,
        sd3NarcissismScore: 4.889,
      },
      straightLineFlags: [],
      aaq2Score: 20,
      rsesScore: 25,
    });
    expect(merged.gateFailReasons).toContain(SD3_NARCISSISM_FLOOR_FAIL_CODE);
    const psychFloors = merged.gateFailDetail.psychometric_floors as Record<
      string,
      { score: number; description: string }
    >;
    expect(psychFloors[SD3_NARCISSISM_FLOOR_FAIL_CODE]?.score).toBeCloseTo(4.889);
    expect(psychFloors[SD3_NARCISSISM_FLOOR_FAIL_CODE]?.description).toContain('SD3 narcissism');
  });

  it('does not add instrument floors when straight-line suppresses', () => {
    const merged = mergePsychometricFloorsIntoGateState({
      existingFailReasons: [],
      existingDetail: null,
      scores: { rfqScore: 4, gaspScore: 5.7, dweckScore: 4, scsSfScore: 4, sd3NarcissismScore: 2 },
      straightLineFlags: [GASP_STRAIGHT_LINE_FLAG],
      aaq2Score: 20,
      rsesScore: 25,
    });
    expect(merged.gateFailReasons).not.toContain(GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE);
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
    const scores = { ...BASE_SCORES, gaspScore: 5.7, dweckScore: 1.8, rsesScore: 10, aaq2Score: 44 };
    const result = computePsychometricModifier(scores);
    const expected = collectPsychometricFloorGateFailReasons(
      {
        rfqScore: scores.rfqScore,
        gaspScore: scores.gaspScore,
        dweckScore: scores.dweckScore,
        scsSfScore: scores.scsSfScore,
        sd3NarcissismScore: scores.sd3NarcissismScore,
      },
      result.straightLineFlags,
      { aaq2Score: scores.aaq2Score, rsesScore: scores.rsesScore },
    );
    expect(result.psychometricFloorBreaches.sort()).toEqual(expected.sort());
    expect(result.psychometricFloorBreaches).toContain(LOW_SELF_ESTEEM_FLOOR_CODE);
    expect(result.psychometricFloorBreaches).toContain(HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE);
  });

  it('ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES includes legacy RSES and AAQ floors', () => {
    expect(ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES).toContain(LOW_SELF_ESTEEM_FLOOR_CODE);
    expect(ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES).toContain(HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE);
  });

  it('normalizePsychometricFloorsGateDetail rebuilds keyed detail from legacy string[]', () => {
    const normalized = normalizePsychometricFloorsGateDetail(
      [
        RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
        GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE,
      ],
      {
        rfqScore: 1.625,
        gaspScore: 5.7,
        dweckScore: 4,
        scsSfScore: 4,
        sd3NarcissismScore: 2,
      },
    );
    expect(Array.isArray(normalized)).toBe(false);
    expect(normalized[RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE]?.score).toBe(1.625);
    expect(normalized[GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE]?.description).toContain('GASP externalization');
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
        gaspScore: 5.7,
        dweckScore: 4,
        scsSfScore: 4,
        sd3NarcissismScore: 2,
      },
      straightLineFlags: [],
      aaq2Score: 20,
      rsesScore: 25,
    });
    const psychFloors = merged.gateFailDetail.psychometric_floors as Record<
      string,
      { score: number; description: string }
    >;
    expect(Array.isArray(psychFloors)).toBe(false);
    expect(psychFloors[RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE]?.score).toBe(1.625);
    expect(psychFloors[GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE]?.description).toContain('GASP externalization');
  });

  it('mergePsychometricFloorsIntoGateState produces rich detail for all triggered floors', () => {
    const merged = mergePsychometricFloorsIntoGateState({
      existingFailReasons: [],
      existingDetail: null,
      scores: {
        rfqScore: 1.625,
        gaspScore: 5.7,
        dweckScore: 1.8,
        scsSfScore: 1.25,
        sd3NarcissismScore: 4.889,
      },
      straightLineFlags: [],
      aaq2Score: 44,
      rsesScore: 10,
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
});
