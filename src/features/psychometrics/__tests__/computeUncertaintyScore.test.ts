import { describe, expect, it } from '@jest/globals';
import {
  computeUncertaintyScore,
  isUncertaintyBreakdownPopulated,
  uncertaintyBreakdownForStorage,
  UNCERTAINTY_ROUTING_THRESHOLD,
} from '../computeUncertaintyScore';

const EMPTY_ATTEMPT = {
  weighted_score: 8,
  pillar_scores: {},
  scenario_composites: { s1: 7, s2: 7, s3: 7 },
  mentalizing_overcertainty_count: 0,
  defense_patterns: {},
  review_flags: [],
  personal_moment_emotional_vocab_low: false,
  disclosure_calibration: 'calibrated',
  scenario_1_scores: null,
  scenario_2_scores: null,
  scenario_3_scores: null,
  psychometric_straight_line_flags: [],
  psychometrics_gasp_externalization_score: 3,
  psychometrics_aaq2_score: 15,
  psychometrics_brs_score: 4,
  psychometrics_rses_score: 28,
  psychometrics_scs_sf_score: 4,
  psychometrics_dweck_score: 4,
  psychometrics_sd3_narcissism_score: 2,
  psychometrics_rfq_score: 5,
  reasoning_pending: false,
};

describe('computeUncertaintyScore', () => {
  it('scores low uncertainty when score is well above threshold with no flags', () => {
    const result = computeUncertaintyScore({ ...EMPTY_ATTEMPT, weighted_score: 8 });
    expect(result.total).toBeLessThan(UNCERTAINTY_ROUTING_THRESHOLD);
  });

  it('flags SD3 narcissism and RFQ consistency divergences', () => {
    const result = computeUncertaintyScore({
      ...EMPTY_ATTEMPT,
      weighted_score: 6.1,
      pillar_scores: {
        accountability: 8,
        contempt: 4,
        mentalizing: 7.5,
      },
      psychometrics_sd3_narcissism_score: 4.5,
      psychometrics_rfq_score: 3,
    });
    expect(result.activeFlags).toContain('sd3_narcissism_contempt_divergence');
    expect(result.activeFlags).toContain('rfq_mentalizing_divergence_low_self_report');
    expect(result.activeFlags).toContain('sd3_narcissism_floor');
  });

  it('flags sd3_narcissism_floor when straight-line is active but score breaches threshold', () => {
    const result = computeUncertaintyScore({
      ...EMPTY_ATTEMPT,
      psychometrics_sd3_narcissism_score: 4.5,
      psychometric_straight_line_flags: ['sd3_narcissism_straight_line'],
    });
    expect(result.activeFlags).toContain('sd3_narcissism_floor');
  });

  it('flags psychometric floor breaches in active flags', () => {
    const result = computeUncertaintyScore({
      ...EMPTY_ATTEMPT,
      psychometrics_rfq_score: 1.8,
      psychometrics_gasp_externalization_score: 4.75,
      psychometrics_dweck_score: 2.3,
      psychometrics_scs_sf_score: 2.417,
    });
    expect(result.activeFlags).toContain('rfq_low_reflective_functioning_floor');
    expect(result.activeFlags).toContain('gasp_extreme_externalization_floor');
    expect(result.activeFlags).toContain('dweck_extreme_fixed_mindset_floor');
    expect(result.activeFlags).toContain('scs_sf_low_self_compassion_floor');
  });

  it('flags psychometric floors when straight-line flags are active but scores breach thresholds', () => {
    const result = computeUncertaintyScore({
      ...EMPTY_ATTEMPT,
      psychometrics_rfq_score: 1.8,
      psychometrics_gasp_externalization_score: 4.75,
      psychometrics_dweck_score: 2.3,
      psychometrics_scs_sf_score: 2.417,
      psychometric_straight_line_flags: [
        'rfq_straight_line',
        'gasp_straight_line',
        'dweck_straight_line',
        'scs_sf_straight_line',
      ],
    });
    expect(result.activeFlags).toContain('rfq_low_reflective_functioning_floor');
    expect(result.activeFlags).toContain('gasp_extreme_externalization_floor');
    expect(result.activeFlags).toContain('dweck_extreme_fixed_mindset_floor');
    expect(result.activeFlags).toContain('scs_sf_low_self_compassion_floor');
  });

  it('flags high RFQ vs low mentalizing divergence', () => {
    const result = computeUncertaintyScore({
      ...EMPTY_ATTEMPT,
      pillar_scores: { mentalizing: 3.5 },
      psychometrics_rfq_score: 5.8,
    });
    expect(result.activeFlags).toContain('rfq_mentalizing_divergence_high_self_report');
  });

  it('adds uncertainty when defense cross-reference recommends admin review for contradiction', () => {
    const base = computeUncertaintyScore({ ...EMPTY_ATTEMPT });
    const withCrossRef = computeUncertaintyScore({
      ...EMPTY_ATTEMPT,
      defenseCrossReference: {
        overallConfidence: 'moderate',
        recommendAdminReview: true,
        modifierAdjustment: 0.15,
        flags: [
          {
            defense: 'projection',
            detected: true,
            selfReportConsistent: false,
            confidenceLevel: 'low',
            flagName: 'projection_self_report_contradiction',
            description: 'test',
          },
        ],
      },
    });
    expect(withCrossRef.total).toBeGreaterThan(base.total);
    expect(withCrossRef.activeFlags).toContain('defense_cross_reference_contradiction_1');
  });

  it('adds uncertainty for defense possible false negative flag', () => {
    const result = computeUncertaintyScore({
      ...EMPTY_ATTEMPT,
      defenseCrossReference: {
        overallConfidence: 'high',
        recommendAdminReview: true,
        modifierAdjustment: 0,
        flags: [
          {
            defense: 'possible_missed_detection',
            detected: false,
            selfReportConsistent: null,
            confidenceLevel: 'low',
            flagName: 'defense_possible_false_negative',
            description: 'test',
          },
        ],
      },
    });
    expect(result.activeFlags).toContain('defense_possible_false_negative');
    expect(result.components.depthSignalConcerns).toBeGreaterThanOrEqual(0.15);
  });

  it('adds gaming correction uncertainty for level 2 and 3', () => {
    const level2 = computeUncertaintyScore({
      ...EMPTY_ATTEMPT,
      gamingCorrectionLevel: 2,
    });
    expect(level2.components.gamingCorrection).toBe(0.15);
    expect(level2.activeFlags).toContain('gaming_correction_level_2');

    const level3 = computeUncertaintyScore({
      ...EMPTY_ATTEMPT,
      gamingCorrectionLevel: 3,
    });
    expect(level3.components.gamingCorrection).toBe(0.25);
    expect(level3.activeFlags).toContain('gaming_correction_level_3');
    expect(level3.activeFlags).toContain('gaming_correction_severe');
  });
});

describe('uncertaintyBreakdownForStorage', () => {
  it('includes all component keys and activeFlags for jsonb persist', () => {
    const result = computeUncertaintyScore({
      ...EMPTY_ATTEMPT,
      weighted_score: 6.1,
      psychometric_straight_line_flags: ['aaq2_straight_line'],
    });
    const stored = uncertaintyBreakdownForStorage(result);
    expect(isUncertaintyBreakdownPopulated(stored)).toBe(true);
    expect(stored.components).toEqual({
      thresholdProximity: expect.any(Number),
      consistencyFlags: expect.any(Number),
      depthSignalConcerns: expect.any(Number),
      scoreRecovery: expect.any(Number),
      scenarioVariance: expect.any(Number),
      straightLineFlags: expect.any(Number),
      gamingCorrection: expect.any(Number),
    });
    expect(stored.activeFlags.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(stored))).toEqual(stored);
  });
});
