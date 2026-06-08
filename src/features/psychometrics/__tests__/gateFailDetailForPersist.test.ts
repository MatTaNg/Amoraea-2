import { describe, expect, it } from '@jest/globals';
import {
  EMPTY_GATE_FAIL_DETAIL_FOR_PERSIST,
  normalizeGateFailDetailForPersist,
} from '../gateFailDetailForPersist';
import {
  collectPsychometricFloorGateFailReasons,
  mergePsychometricFloorsIntoGateState,
} from '../psychometricFloorBreaches';

const REGRESSION_FLOOR_SCORES = {
  rfqScore: 1.75,
  gaspScore: 5.7,
  dweckScore: 2.3,
  scsSfScore: 2.417,
  sd3NarcissismScore: 4.111,
  brsScore: 1.5,
  anxietyTraitScore: 2.5,
  aaq2Score: 34,
  rsesScore: 10,
  scsPublicScore: 18,
  scsPrivateScore: 9,
};

describe('normalizeGateFailDetailForPersist', () => {
  it('returns psychometric_floors object when detail is null', () => {
    expect(normalizeGateFailDetailForPersist(null)).toEqual({
      psychometric_floors: {},
    });
  });

  it('preserves interview gate keys and adds empty psychometric_floors', () => {
    const normalized = normalizeGateFailDetailForPersist({
      weighted_score: { score: 5.4, requiredMin: 6 },
    });
    expect(normalized).toEqual({
      weighted_score: { score: 5.4, requiredMin: 6 },
      psychometric_floors: {},
    });
  });

  it('replaces legacy psychometric_floors string[] with empty object', () => {
    const normalized = normalizeGateFailDetailForPersist({
      psychometric_floors: ['aaq2_high_experiential_avoidance_floor'],
    });
    expect(normalized.psychometric_floors).toEqual({});
  });

  it('EMPTY_GATE_FAIL_DETAIL_FOR_PERSIST matches normalized null', () => {
    expect(EMPTY_GATE_FAIL_DETAIL_FOR_PERSIST).toEqual(normalizeGateFailDetailForPersist(null));
  });
});

const ADMIN_RECALC_USER_FLOOR_SCORES = {
  rfqScore: 1.75,
  gaspScore: 4.75,
  dweckScore: 2,
  scsSfScore: 2.25,
  sd3NarcissismScore: 3.222,
  brsScore: 1.667,
  anxietyTraitScore: 5,
  aaq2Score: 37,
  rsesScore: 13,
  scsPublicScore: 18,
  scsPrivateScore: 3,
};

describe('admin recalculation psychometric floor merge', () => {
  it('fires nine instrument floors for admin recalc regression user (SD3 below threshold)', () => {
    const breaches = collectPsychometricFloorGateFailReasons(ADMIN_RECALC_USER_FLOOR_SCORES, []);
    expect(breaches).toHaveLength(9);
    expect(breaches).not.toContain('sd3_narcissism_floor');
  });

  it('produces nine floor breaches with rich keyed psychometric_floors detail', () => {
    const breaches = collectPsychometricFloorGateFailReasons(REGRESSION_FLOOR_SCORES, []);
    expect(breaches).toHaveLength(9);

    const merged = mergePsychometricFloorsIntoGateState({
      existingFailReasons: [],
      existingDetail: normalizeGateFailDetailForPersist(null),
      scores: REGRESSION_FLOOR_SCORES,
      straightLineFlags: [],
    });

    expect(merged.gateFailReasons).toHaveLength(9);
    const psychFloors = merged.gateFailDetail.psychometric_floors as Record<
      string,
      { score: number; description: string }
    >;
    expect(psychFloors).not.toBeNull();
    for (const floorId of merged.gateFailReasons) {
      expect(psychFloors[floorId]?.score).toEqual(expect.any(Number));
      expect(psychFloors[floorId]?.description).toEqual(expect.any(String));
    }
    expect(normalizeGateFailDetailForPersist(merged.gateFailDetail).psychometric_floors).toEqual(
      psychFloors,
    );
  });
});
