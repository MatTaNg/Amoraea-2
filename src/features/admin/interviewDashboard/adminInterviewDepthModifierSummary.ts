import { computeGateResultCore, GATE_PASS_WEIGHTED_MIN, type GateResult } from '@features/aria/computeGateResultCore';
import { buildAdminGateComputeOptions } from '@features/admin/interviewDashboard/adminInterviewAttemptAdminUtils';
import {
  buildStoredGateFailureLines,
  parseGateFailDetailRow,
  resolveAdminPrimaryOutcomeDisplay,
} from '@features/admin/interviewDashboard/adminInterviewDashboardGateDisplay';
import { formatScoreCell, pillarScoresForGate } from '@features/admin/interviewDashboard/adminInterviewDashboardScoreUtils';
import type { AttemptRow, UserRow } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export type AdminNegativeScoreModifier = {
  id: string;
  label: string;
  value: number;
};

export function collectAdminNegativeScoreModifiers(
  attempt: AttemptRow,
  gateEcho?: GateResult | null,
): AdminNegativeScoreModifier[] {
  const gate =
    gateEcho ??
    computeGateResultCore(pillarScoresForGate(attempt), null, buildAdminGateComputeOptions(attempt));
  const items: AdminNegativeScoreModifier[] = [];
  const add = (id: string, label: string, value: number | null | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value >= 0) return;
    items.push({ id, label, value });
  };

  add('ego_development', 'Ego development level', gate.egoDevelopmentModifier);
  add('defense_patterns', 'Defense patterns', gate.defensePatternScoreAdjustment);
  add('personal_moment_concreteness', 'Personal moment concreteness', gate.personalMomentConcretenessModifier);
  add('psychometric', 'Psychometric modifier', attempt.psychometric_modifier_applied);

  const correctedPsych = attempt.corrected_psychometric_modifier;
  if (
    typeof correctedPsych === 'number' &&
    Number.isFinite(correctedPsych) &&
    correctedPsych < 0 &&
    correctedPsych !== attempt.psychometric_modifier_applied
  ) {
    items.push({ id: 'psychometric_corrected', label: 'Psychometric modifier (corrected)', value: correctedPsych });
  }

  return items.sort((a, b) => a.value - b.value);
}

function resolveAttemptThreshold(attempt: AttemptRow): number {
  const wReq = parseGateFailDetailRow(attempt)?.weighted_score?.requiredMin;
  return typeof wReq === 'number' && Number.isFinite(wReq) ? wReq : GATE_PASS_WEIGHTED_MIN;
}

function resolveAttemptComparisonScore(attempt: AttemptRow): number | null {
  const candidates = [
    attempt.modified_weighted_score_with_psychometrics,
    attempt.modified_weighted_score,
    attempt.weighted_score,
  ];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return c;
  }
  return null;
}

function formatGatePrimaryFailurePhrase(attempt: AttemptRow): string | null {
  const lines = buildStoredGateFailureLines(attempt);
  if (lines.length > 0) return lines[0] ?? null;
  return null;
}

/** Plain-language pass/fail explanation for admin Summary tab (Tab 1). */
export function buildAdminPassFailPlainLanguageSummary(
  user: Pick<UserRow, 'interview_passed' | 'interview_passed_computed' | 'interview_passed_admin_override'> | null | undefined,
  attempt: AttemptRow | null,
): string | null {
  if (!attempt) return null;

  const outcome = resolveAdminPrimaryOutcomeDisplay(user, attempt);
  if (outcome.outcomeLabel === 'none') {
    return 'No pass/fail result yet — scoring incomplete or interview still in progress.';
  }

  const gateEcho = computeGateResultCore(
    pillarScoresForGate(attempt),
    null,
    buildAdminGateComputeOptions(attempt),
  );
  const threshold = resolveAttemptThreshold(attempt);
  const comparisonScore = resolveAttemptComparisonScore(attempt);
  const scoreText = comparisonScore != null ? formatScoreCell(comparisonScore) : '—';
  const thresholdText = threshold.toFixed(1);
  const topModifier = collectAdminNegativeScoreModifiers(attempt, gateEcho)[0];
  const modifierTail = topModifier
    ? `, driven primarily by ${topModifier.label.toLowerCase()} (${topModifier.value.toFixed(2)})`
    : '';
  const gateFailure = formatGatePrimaryFailurePhrase(attempt);

  if (outcome.outcomeLabel === 'pass') {
    if (gateFailure) {
      return `Passed: ${gateFailure}. Final comparison score ${scoreText} vs. required ${thresholdText}.`;
    }
    return `Passed: comparison score ${scoreText} met the required ${thresholdText}, with no blocking gate failures.`;
  }

  if (outcome.outcomeLabel === 'almost') {
    const detail = outcome.detail ? ` ${outcome.detail}.` : '';
    return `Almost: comparison score ${scoreText} vs. required ${thresholdText}${modifierTail}.${detail}`;
  }

  if (gateFailure) {
    return `Failed: ${gateFailure}${modifierTail}.`;
  }

  return `Failed: comparison score ${scoreText} vs. required ${thresholdText}${modifierTail}.`;
}
