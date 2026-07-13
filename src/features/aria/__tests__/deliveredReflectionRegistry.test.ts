import { describe, expect, it } from '@jest/globals';

import {
  extractLeadingReflectionFromMoment4ThresholdProbe,
  extractLeadingReflectionFromMoment5HandoffBundle,
  isReflectionDuplicateOfRegistry,
  reflectionsAreNearIdentical,
  registerDeliveredReflection,
} from '../deliveredReflectionRegistry';
import { buildMoment4ThresholdProbeWithReflection } from '../moment4ProbeLogic';
import { buildMoment4ThresholdAnswerToMoment5Bundle } from '../interviewTransitionBundles';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '../probeAndScoringUtils';

describe('deliveredReflectionRegistry', () => {
  it('detects near-identical reflection sentences', () => {
    const a = 'You focused on naming what the line looks like for you rather than leaving it vague.';
    const b = 'You focused on naming what the line looks like for you rather than leaving it vague';
    expect(reflectionsAreNearIdentical(a, b)).toBe(true);
  });

  it('registers delivered reflections', () => {
    const registryRef = { current: [] as Array<{ slot: 'm4_grudge_to_threshold'; text: string; deliveredAtMs: number }> };
    registerDeliveredReflection(registryRef, 'm4_grudge_to_threshold', 'You named your ex and the falling-out.', {
      source: 'test',
    });
    expect(registryRef.current).toHaveLength(1);
    expect(isReflectionDuplicateOfRegistry(registryRef.current, 'You named your ex and the falling-out.')).toBe(
      true,
    );
  });
});

describe('M4/M5 handoff reflection dedup', () => {
  const genericThresholdAnswer =
    'I would keep trying to work through things unless there is clearly no path forward and then I would walk away from it.';

  it('uses distinct reflections for threshold→M5 when grudge→threshold has no reflection', () => {
    const grudge =
      'My college roommate and I had a falling out over money and I still hold resentment because he never apologized.';
    const registry: Array<{ slot: string; text: string; deliveredAtMs: number }> = [];
    const m4Probe = buildMoment4ThresholdProbeWithReflection(grudge, { deliveredRegistry: registry });
    const m4Reflection = extractLeadingReflectionFromMoment4ThresholdProbe(m4Probe);
    expect(m4Reflection).toBeNull();

    const m5Bundle = buildMoment4ThresholdAnswerToMoment5Bundle(
      'Sam',
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      genericThresholdAnswer,
      { deliveredRegistry: registry },
    );
    const m5Reflection = extractLeadingReflectionFromMoment5HandoffBundle(m5Bundle);
    expect(m5Reflection).toBeTruthy();
    expect(reflectionsAreNearIdentical(m4Reflection!, m5Reflection!)).toBe(false);
  });

  it('uses alternate threshold reflection when registry already has the generic line', () => {
    const duplicate =
      'You focused on naming what the line looks like for you rather than leaving it vague.';
    const registry = [{ slot: 'm4_grudge_to_threshold' as const, text: duplicate, deliveredAtMs: 0 }];
    const m5Bundle = buildMoment4ThresholdAnswerToMoment5Bundle(
      'Sam',
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      genericThresholdAnswer,
      { deliveredRegistry: registry },
    );
    const m5Reflection = extractLeadingReflectionFromMoment5HandoffBundle(m5Bundle);
    expect(m5Reflection).toBeTruthy();
    expect(reflectionsAreNearIdentical(duplicate, m5Reflection!)).toBe(false);
    expect(m5Bundle).toContain("Here's one more question about you");
    expect(m5Bundle).toContain(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
  });

  it('does not suppress threshold→M5 reflection when only scenario_boundary slot has similar text', () => {
    const scenarioBoundaryReflection =
      'You spelled out what has to shift for you to keep working at it versus when walking away is right.';
    const registry = [
      { slot: 'scenario_boundary' as const, text: scenarioBoundaryReflection, deliveredAtMs: 0 },
    ];
    const m5Bundle = buildMoment4ThresholdAnswerToMoment5Bundle(
      'Sam',
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      genericThresholdAnswer,
      { deliveredRegistry: registry },
    );
    const m5Reflection = extractLeadingReflectionFromMoment5HandoffBundle(m5Bundle);
    expect(m5Reflection).toBeTruthy();
    expect(m5Bundle).toContain("Here's one more question about you");
  });
});
