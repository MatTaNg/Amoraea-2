import { describe, expect, it } from '@jest/globals';

import {
  GATE_MARKER_BASE_WEIGHTS,
  GATE_PASS_WEIGHTED_MIN,
  REFERRAL_WEIGHTED_PASS_MIN,
} from '../scoring/interviewGateThresholds';
import {
  ELABORATION_COMPENSATORY_REPAIR_MAX_WORD_COUNT,
  ELABORATION_LOGISTICS_REPAIR_MAX_WORD_COUNT,
  ELABORATION_SCENARIO_DEPTH_WORD_THRESHOLD_MULTI_TURN,
  ELABORATION_SCENARIO_DEPTH_WORD_THRESHOLD_SINGLE_TURN,
} from '../scoring/elaborationAbsenceCeilings';
import {
  PILLAR_NARRATIVE_BAND_DEVELOPING_MIN,
  PILLAR_NARRATIVE_BAND_GOOD_MIN,
  PILLAR_NARRATIVE_BAND_NEEDS_ATTENTION_MIN,
  PILLAR_NARRATIVE_BAND_STRONG_MIN,
} from '../reports/pillarNarrativeBands';
import {
  ATTACHMENT_HIGH_ANXIETY_OR_AVOIDANCE_MIN,
  BRS_INSIGHT_HIGH_MIN,
  BRS_INSIGHT_LOW_MAX,
  DSIR_INSIGHT_HIGH_MIN,
  DSIR_INSIGHT_LOW_MAX,
} from '../onboarding/assessmentInsightTiers';
import {
  CONFLICT_AAQ2_HIGH_MIN,
  CONFLICT_REGULATION_STRONG_MIN,
} from '../reports/evidenceConflictThresholds';
import { EMOTION_ITEM_CORRECT_ANSWERS } from '../scoring/emotionRecognitionItems';
import { COMMUNICATION_FLOOR_MIN_AVG_WORDS } from '../scoring/communicationFloor';

describe('config consistency', () => {
  it('gate marker base weights sum to 1', () => {
    const sum = Object.values(GATE_MARKER_BASE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('referral pass threshold is below standard pass threshold', () => {
    expect(REFERRAL_WEIGHTED_PASS_MIN).toBeLessThan(GATE_PASS_WEIGHTED_MIN);
  });

  it('pillar narrative bands are strictly ordered', () => {
    expect(PILLAR_NARRATIVE_BAND_NEEDS_ATTENTION_MIN).toBeLessThan(PILLAR_NARRATIVE_BAND_DEVELOPING_MIN);
    expect(PILLAR_NARRATIVE_BAND_DEVELOPING_MIN).toBeLessThan(PILLAR_NARRATIVE_BAND_GOOD_MIN);
    expect(PILLAR_NARRATIVE_BAND_GOOD_MIN).toBeLessThan(PILLAR_NARRATIVE_BAND_STRONG_MIN);
  });

  it('onboarding insight tiers are ordered and in valid ranges', () => {
    expect(DSIR_INSIGHT_LOW_MAX).toBeLessThan(DSIR_INSIGHT_HIGH_MIN);
    expect(BRS_INSIGHT_LOW_MAX).toBeLessThan(BRS_INSIGHT_HIGH_MIN);
    expect(ATTACHMENT_HIGH_ANXIETY_OR_AVOIDANCE_MIN).toBeGreaterThan(1);
    expect(ATTACHMENT_HIGH_ANXIETY_OR_AVOIDANCE_MIN).toBeLessThan(7);
  });

  it('elaboration word-count thresholds are ordered sensibly', () => {
    expect(ELABORATION_SCENARIO_DEPTH_WORD_THRESHOLD_MULTI_TURN).toBeLessThan(
      ELABORATION_SCENARIO_DEPTH_WORD_THRESHOLD_SINGLE_TURN,
    );
    expect(ELABORATION_LOGISTICS_REPAIR_MAX_WORD_COUNT).toBeLessThan(
      ELABORATION_COMPENSATORY_REPAIR_MAX_WORD_COUNT,
    );
  });

  it('evidence conflict thresholds are positive where required', () => {
    expect(CONFLICT_AAQ2_HIGH_MIN).toBeGreaterThan(0);
    expect(CONFLICT_REGULATION_STRONG_MIN).toBeGreaterThan(0);
  });

  it('emotion recognition battery has three keyed answers', () => {
    expect(EMOTION_ITEM_CORRECT_ANSWERS).toHaveLength(3);
    expect(EMOTION_ITEM_CORRECT_ANSWERS.every((a) => /^[A-D]$/.test(a))).toBe(true);
  });

  it('communication floor minimum is a positive word count', () => {
    expect(COMMUNICATION_FLOOR_MIN_AVG_WORDS).toBeGreaterThan(0);
  });
});
