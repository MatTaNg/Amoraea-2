import { describe, expect, it } from '@jest/globals';

import { ensureGateFailReasonsForFailedInterviewGate } from '@features/psychometrics/gateFailReasonsNormalize';
import { GATE_PASS_WEIGHTED_MIN, REFERRAL_WEIGHTED_PASS_MIN } from '../computeGateResultCore';
import {
  buildScenarioCompositesTriple,
  readPillarScoresFromScenarioBundle,
} from '../scenarioCompositeFloor';

describe('ensureGateFailReasonsForFailedInterviewGate', () => {
  it('backfills weighted_score when final gate fails with empty reasons and low modified score', () => {
    const out = ensureGateFailReasonsForFailedInterviewGate({
      gateFailReasons: [],
      depthSignalModifiedScore: 1.9,
      finalModifiedScoreWithPsychometrics: 0.65,
      finalGatePass: false,
      gateFailDetail: { psychometric_floors: {} },
    });
    expect(out.gateFailReasons).toEqual(['weighted_score']);
    expect(out.gateFailDetail.weighted_score).toEqual({
      score: 0.65,
      requiredMin: GATE_PASS_WEIGHTED_MIN,
    });
    expect(out.gateFailDetail.psychometric_floors).toEqual({});
  });

  it('uses canonical requiredMin even when referral weightedPassMin is lower', () => {
    const out = ensureGateFailReasonsForFailedInterviewGate({
      gateFailReasons: [],
      depthSignalModifiedScore: 6.1,
      finalGatePass: false,
      weightedPassMin: REFERRAL_WEIGHTED_PASS_MIN,
      gateFailDetail: {},
    });
    expect(out.gateFailReasons).toEqual(['weighted_score']);
    expect(out.gateFailDetail.weighted_score).toEqual({
      score: 6.1,
      requiredMin: GATE_PASS_WEIGHTED_MIN,
    });
  });

  it('leaves passing gate reasons unchanged', () => {
    const out = ensureGateFailReasonsForFailedInterviewGate({
      gateFailReasons: [],
      depthSignalModifiedScore: 7.2,
      finalModifiedScoreWithPsychometrics: 7.4,
      finalGatePass: true,
      gateFailDetail: {},
    });
    expect(out.gateFailReasons).toEqual([]);
  });
});

describe('scenario composite helpers', () => {
  it('reads pillar_scores snake_case bundles and computes composites with floor values', () => {
    const bundle = {
      pillar_scores: { accountability: 1, repair: 2, mentalizing: 3, attunement: 4 },
      contempt_tier_breakdown: null,
    };
    expect(readPillarScoresFromScenarioBundle(bundle)?.accountability).toBe(1);
    const triple = buildScenarioCompositesTriple({
      1: bundle,
      2: bundle,
      3: bundle,
    });
    expect(triple['1']).toBe(2.5);
    expect(triple['2']).toBe(2.5);
    expect(triple['3']).toBe(2.5);
  });
});
