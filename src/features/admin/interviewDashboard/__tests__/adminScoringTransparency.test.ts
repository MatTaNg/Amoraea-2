import { describe, expect, it } from '@jest/globals';
import {
  buildSuppressedDepthModifierNotice,
  filterDeprecatedAdminReviewFlags,
  formatDisclosureCalibrationForAdmin,
} from '../adminDeprecatedDepthConstructs';
import {
  adminNarrativeFailureKindLabel,
  parseAdminNarrativeFailureTimeline,
} from '../adminNarrativeFailureDisplay';
import type { AttemptRow } from '../adminInterviewDashboardTypes';

describe('adminDeprecatedDepthConstructs', () => {
  it('hides deprecated review flags and overdisclosure calibration label', () => {
    expect(
      filterDeprecatedAdminReviewFlags(['defense_pattern_review', 'overdisclosure_review', 'projection_self_report_confirmed']),
    ).toEqual(['defense_pattern_review']);
    expect(formatDisclosureCalibrationForAdmin('overdisclosure')).toBe('Calibrated');
    expect(formatDisclosureCalibrationForAdmin('underdisclosure')).toBe('Underdisclosure');
  });

  it('infers suppressed underdisclosure when concreteness pair modifier is larger', () => {
    const attempt = {
      disclosure_calibration: 'underdisclosure',
      moment_4_concreteness: 'absent',
      moment_5_concreteness: 'absent',
    } as AttemptRow;

    expect(buildSuppressedDepthModifierNotice(attempt)).toContain('Underdisclosure');
    expect(buildSuppressedDepthModifierNotice(attempt)).toContain('suppressed');
    expect(buildSuppressedDepthModifierNotice(attempt)).toContain('-0.50');
  });
});

describe('adminNarrativeFailureDisplay', () => {
  it('classifies timeout and race-condition failures and builds a timeline', () => {
    const parsed = parseAdminNarrativeFailureTimeline({
      _narrativeFailed: true,
      _generationFailed: true,
      last_error: 'IDLE_TIMEOUT narrative generation exceeded 45s',
      failed_at: '2026-05-01T12:00:00.000Z',
      _lastRetryError: 'missing_pillar_scores on retry',
      _lastRetryFailedAt: '2026-05-01T12:05:00.000Z',
    });

    expect(parsed.failed).toBe(true);
    expect(parsed.primaryError).toBe('missing_pillar_scores on retry');
    expect(parsed.primaryKind).toBe('race_condition');
    expect(parsed.events).toHaveLength(2);
    expect(adminNarrativeFailureKindLabel('timeout')).toContain('Timeout');
    expect(adminNarrativeFailureKindLabel('race_condition')).toContain('Race condition');
  });
});
