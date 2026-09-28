import { DISCLOSURE_UNDER_MODIFIER, countDefensePatternsForDepthModifier } from '@config/scoring/depthSignalModifiers';
import { moment4Moment5ConcretenessDepthSignalDelta } from '@features/aria/moment4ConcretenessClassification';
import type { DefensePatternsJson } from '@features/aria/defensePatternsDetection';
import { parseObject } from '@features/admin/interviewDashboard/adminInterviewDashboardScoreUtils';
import type { AttemptRow } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

const DEPRECATED_REVIEW_FLAG_IDS = new Set([
  'overdisclosure_review',
  'projection_self_report_contradiction',
  'projection_insufficient_psychometric_data',
  'projection_self_report_confirmed',
  'projection_self_report_neutral',
]);

export function isDeprecatedAdminReviewFlag(flag: string): boolean {
  if (DEPRECATED_REVIEW_FLAG_IDS.has(flag)) return true;
  return flag.startsWith('projection_');
}

export function filterDeprecatedAdminReviewFlags(flags: string[]): string[] {
  return flags.filter((flag) => !isDeprecatedAdminReviewFlag(flag));
}

/** Admin UI: only Underdisclosure or Calibrated — hide legacy overdisclosure values. */
export function formatDisclosureCalibrationForAdmin(
  calibration: string | null | undefined,
): 'Underdisclosure' | 'Calibrated' | '—' {
  const value = (calibration ?? '').trim().toLowerCase();
  if (value === 'underdisclosure') return 'Underdisclosure';
  if (value === 'calibrated' || value === 'overdisclosure') return 'Calibrated';
  return '—';
}

export function countAdminScoringDefensePatterns(
  dp: DefensePatternsJson | null | undefined,
): number {
  return countDefensePatternsForDepthModifier(dp);
}

type SuppressedModifierPersisted = {
  suppressed?: string;
  applied?: string;
  suppressed_value?: number;
  applied_value?: number;
};

function readPersistedSuppressedModifier(attempt: AttemptRow): SuppressedModifierPersisted | null {
  const rowField = (attempt as { suppressed_modifier?: unknown }).suppressed_modifier;
  if (rowField && typeof rowField === 'object' && !Array.isArray(rowField)) {
    return rowField as SuppressedModifierPersisted;
  }
  const detail = parseObject(attempt.gate_fail_detail);
  const fromDetail = detail?.suppressed_modifier;
  if (fromDetail && typeof fromDetail === 'object' && !Array.isArray(fromDetail)) {
    return fromDetail as SuppressedModifierPersisted;
  }
  return null;
}

function formatModifierPhrase(label: string, value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const sign = rounded > 0 ? '+' : '';
  return `${label} (${sign}${rounded.toFixed(2)})`;
}

/**
 * Surfaces concreteness vs underdisclosure suppression for admin transparency.
 * Uses persisted `suppressed_modifier` when present; otherwise infers from stored signals.
 */
export function buildSuppressedDepthModifierNotice(attempt: AttemptRow): string | null {
  const persisted = readPersistedSuppressedModifier(attempt);
  if (persisted?.suppressed && persisted?.applied) {
    const suppressedVal =
      typeof persisted.suppressed_value === 'number' ? persisted.suppressed_value : null;
    const appliedVal = typeof persisted.applied_value === 'number' ? persisted.applied_value : null;
    if (suppressedVal != null && appliedVal != null) {
      return `${formatModifierPhrase(String(persisted.suppressed), suppressedVal)} would also have applied but was suppressed in favor of ${formatModifierPhrase(String(persisted.applied), appliedVal)}.`;
    }
    return `${persisted.suppressed} was suppressed in favor of ${persisted.applied}.`;
  }

  if (attempt.disclosure_calibration !== 'underdisclosure') return null;

  const concretenessDelta = moment4Moment5ConcretenessDepthSignalDelta(
    attempt.moment_4_concreteness,
    attempt.moment_5_concreteness,
  );
  if (concretenessDelta >= 0) return null;

  const underAbs = Math.abs(DISCLOSURE_UNDER_MODIFIER);
  const concAbs = Math.abs(concretenessDelta);
  if (underAbs === concAbs) return null;

  if (underAbs < concAbs) {
    return `${formatModifierPhrase('Underdisclosure', DISCLOSURE_UNDER_MODIFIER)} would also have applied but was suppressed in favor of the larger concreteness-pair modifier (${concretenessDelta.toFixed(2)}).`;
  }

  return `Concreteness-pair modifier (${concretenessDelta.toFixed(2)}) would also have applied but was suppressed in favor of ${formatModifierPhrase('Underdisclosure', DISCLOSURE_UNDER_MODIFIER)}.`;
}
