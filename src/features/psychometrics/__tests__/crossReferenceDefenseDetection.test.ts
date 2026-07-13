import { describe, expect, it } from '@jest/globals';
import {
  buildDefenseCrossReferenceForAttempt,
  crossReferenceDefenseDetection,
  EMPTY_DEFENSE_CROSS_REFERENCE_RESULT,
} from '../crossReferenceDefenseDetection';

const NO_DEFENSES = {
  projection_detected: false,
  splitting_detected: false,
  rationalization_detected: false,
  denial_detected: false,
};

const EMPTY_PSYCH = {
  gasp_externalization: null,
  rfq_score: null,
  sd3_narcissism_score: null,
  rses_score: null,
  scs_sf_score: null,
  aaq2_score: null,
};

describe('crossReferenceDefenseDetection', () => {
  it('flags false positive projection when self-report contradicts detection', () => {
    const result = crossReferenceDefenseDetection({
      defensePatterns: { ...NO_DEFENSES, projection_detected: true },
      psychometricScores: {
        gasp_externalization: 1.8,
        rfq_score: 5.5,
        sd3_narcissism_score: 1.5,
        rses_score: 28,
        scs_sf_score: 4,
        aaq2_score: 15,
      },
      depthSignalModifierApplied: -0.15,
    });

    expect(result.flags.some((f) => f.flagName === 'projection_self_report_contradiction')).toBe(true);
    expect(result.modifierAdjustment).toBe(0.15);
    expect(result.recommendAdminReview).toBe(true);
    expect(result.overallConfidence).toBe('moderate');
  });

  it('confirms projection when self-report aligns with detection', () => {
    const result = crossReferenceDefenseDetection({
      defensePatterns: { ...NO_DEFENSES, projection_detected: true },
      psychometricScores: {
        gasp_externalization: 5.2,
        rfq_score: 3,
        sd3_narcissism_score: 4.0,
        rses_score: 28,
        scs_sf_score: 4,
        aaq2_score: 15,
      },
      depthSignalModifierApplied: -0.15,
    });

    expect(result.flags.some((f) => f.flagName === 'projection_self_report_confirmed')).toBe(true);
    expect(result.modifierAdjustment).toBe(0);
    expect(result.recommendAdminReview).toBe(false);
    expect(result.overallConfidence).toBe('high');
  });

  it('flags possible false negative when no defenses detected but psychometrics suggest missed detection', () => {
    const result = crossReferenceDefenseDetection({
      defensePatterns: NO_DEFENSES,
      psychometricScores: {
        gasp_externalization: 5.5,
        rfq_score: 2.5,
        sd3_narcissism_score: 4.0,
        rses_score: 28,
        scs_sf_score: 4,
        aaq2_score: 15,
      },
      depthSignalModifierApplied: 0,
    });

    expect(result.flags.some((f) => f.flagName === 'defense_possible_false_negative')).toBe(true);
    expect(result.recommendAdminReview).toBe(true);
    expect(result.modifierAdjustment).toBe(0);
  });

  it('produces insufficient data flags when psychometrics are null', () => {
    const result = crossReferenceDefenseDetection({
      defensePatterns: { ...NO_DEFENSES, projection_detected: true },
      psychometricScores: EMPTY_PSYCH,
      depthSignalModifierApplied: -0.15,
    });

    expect(result.flags.some((f) => f.flagName === 'projection_insufficient_psychometric_data')).toBe(
      true,
    );
    expect(result.modifierAdjustment).toBe(0);
    expect(result.recommendAdminReview).toBe(false);
    expect(result.overallConfidence).toBe('high');
  });

  it('produces no flags for clean profile with no detections', () => {
    const result = crossReferenceDefenseDetection({
      defensePatterns: NO_DEFENSES,
      psychometricScores: {
        gasp_externalization: 2.0,
        rfq_score: 5.5,
        sd3_narcissism_score: 1.5,
        rses_score: 28,
        scs_sf_score: 4,
        aaq2_score: 15,
      },
      depthSignalModifierApplied: 0,
    });

    expect(result.flags).toHaveLength(0);
    expect(result.modifierAdjustment).toBe(0);
    expect(result.recommendAdminReview).toBe(false);
    expect(result.overallConfidence).toBe('high');
  });

  it('buildDefenseCrossReferenceForAttempt always returns an object when splitting is detected', () => {
    const result = buildDefenseCrossReferenceForAttempt({
      defensePatterns: { splitting_detected: true },
      userPsychometrics: {
        psychometrics_sd3_narcissism_score: 4.2,
        psychometrics_rfq_score: 2.5,
      },
      depthSignalModifierApplied: -0.2,
    });

    expect(result).not.toBeNull();
    expect(result.flags.length).toBeGreaterThan(0);
    expect(result.flags.some((f) => f.defense === 'splitting')).toBe(true);
    expect(result.overallConfidence).toMatch(/^(high|moderate|low)$/);
  });

  it('buildDefenseCrossReferenceForAttempt returns empty flags object when no defenses detected', () => {
    const result = buildDefenseCrossReferenceForAttempt({
      defensePatterns: NO_DEFENSES,
      userPsychometrics: {
        psychometrics_gasp_score: 2.0,
        psychometrics_rfq_score: 5.5,
        psychometrics_sd3_narcissism_score: 1.5,
      },
      depthSignalModifierApplied: 0,
    });

    expect(result).toEqual(EMPTY_DEFENSE_CROSS_REFERENCE_RESULT);
  });

  it('buildDefenseCrossReferenceForAttempt never returns null when psychometrics are missing', () => {
    const result = buildDefenseCrossReferenceForAttempt({
      defensePatterns: { projection_detected: true },
      userPsychometrics: null,
      depthSignalModifierApplied: -0.15,
    });

    expect(result).not.toBeNull();
    expect(result.flags.some((f) => f.flagName === 'projection_insufficient_psychometric_data')).toBe(
      true,
    );
  });
});
