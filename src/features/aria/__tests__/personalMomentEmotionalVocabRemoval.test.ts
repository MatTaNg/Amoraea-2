import { describe, expect, it } from '@jest/globals';

import { buildDepthSignalModifierLines } from '@features/admin/depthSignalModifierLines';
import { computeGateResultCore } from '@features/aria/computeGateResultCore';
import { moment4Moment5ConcretenessDepthSignalDelta } from '@features/aria/moment4ConcretenessClassification';
import { computeUncertaintyScore } from '@features/psychometrics/computeUncertaintyScore';

/** Julie session 664dfe29 — weighted 6.20 with depth signals except emotional vocab. */
const JULIE_GATE_PILLARS = {
  repair: 7,
  contempt: 6,
  attunement: 6,
  regulation: 7,
  mentalizing: 6,
  appreciation: 7,
  accountability: 5,
  commitment_threshold: 7,
};

describe('personal moment emotional vocabulary removal', () => {
  it('Julie regression: no vocab modifier line; modified score clears 6.5 threshold', () => {
    const depthLines = buildDepthSignalModifierLines({
      egoDevelopmentLevel: 3,
      moment4Concreteness: 'high',
      moment5Concreteness: 'high',
      emotionRecognitionRawScore: 3,
    });
    expect(depthLines.some((l) => l.label === 'Personal moment emotional vocabulary')).toBe(false);

    const gate = computeGateResultCore(JULIE_GATE_PILLARS, null, {
      precomputedWeightedScore: 6.2,
      egoDevelopmentLevel: 3,
      moment4Concreteness: 'high',
      moment5Concreteness: 'high',
      emotionRecognitionRawScore: 3,
      disclosureCalibration: 'calibrated',
    });

    expect(gate.depthSignalModifier).toBeCloseTo(0.4, 5);
    expect(gate.modifiedWeightedScore).toBeCloseTo(6.6, 5);
    expect(gate.pass).toBe(true);
  });

  it('uncertainty breakdown never emits low_emotional_vocab even when DB flag is stale true', () => {
    const result = computeUncertaintyScore({
      weighted_score: 6.2,
      modified_weighted_score: 6.6,
      passed: true,
      pillar_scores: JULIE_GATE_PILLARS,
      scenario_composites: null,
      personal_moment_emotional_vocab_low: true,
      disclosure_calibration: 'calibrated',
      mentalizing_overcertainty_count: 0,
      defense_patterns: {},
      review_flags: [],
      reasoning_pending: false,
      scenario_1_scores: null,
      scenario_2_scores: null,
      scenario_3_scores: null,
      psychometric_straight_line_flags: null,
      psychometrics_gasp_externalization_score: null,
      psychometrics_aaq2_score: null,
      psychometrics_brs_score: null,
      psychometrics_anxiety_trait_score: null,
      psychometrics_rses_score: null,
      psychometrics_scs_sf_score: null,
      psychometrics_dweck_score: null,
      psychometrics_sd3_narcissism_score: null,
      psychometrics_npi_entitlement_score: null,
      psychometrics_rfq_score: null,
      psychometrics_scs_public_score: null,
      psychometrics_scs_private_score: null,
    });
    expect(result.activeFlags).not.toContain('low_emotional_vocab');
  });

  it('flat avoidant personal answers still penalized via concreteness construct', () => {
    expect(moment4Moment5ConcretenessDepthSignalDelta('absent', 'absent')).toBe(-0.5);
    expect(moment4Moment5ConcretenessDepthSignalDelta('low', 'low')).toBe(-0.3);

    const gate = computeGateResultCore(JULIE_GATE_PILLARS, null, {
      precomputedWeightedScore: 6.2,
      egoDevelopmentLevel: 3,
      moment4Concreteness: 'absent',
      moment5Concreteness: 'absent',
      disclosureCalibration: 'calibrated',
    });
    expect(gate.depthSignalModifier).toBeLessThan(0);
    expect(gate.pass).toBe(false);
  });
});
