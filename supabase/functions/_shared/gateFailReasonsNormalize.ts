import { GATE_PASS_WEIGHTED_MIN } from '../../../src/config/scoring/interviewGateThresholds.ts';

export type NormalizedGateFailCode =
  | 'weighted_score'
  | 'immature_defense_pattern'
  | 'ego_development_floor'
  | 'scenario_floor'
  | 'mentalizing_floor'
  | 'repair_floor';

export const GATE_FAIL_CODE_ORDER: NormalizedGateFailCode[] = [
  'weighted_score',
  'immature_defense_pattern',
  'ego_development_floor',
  'scenario_floor',
  'mentalizing_floor',
  'repair_floor',
];

/** Stable ordering for persisted `gate_fail_reasons`. */
export function orderGateFailCodes(codes: Iterable<NormalizedGateFailCode | string>): NormalizedGateFailCode[] {
  const set = new Set(codes);
  const out: NormalizedGateFailCode[] = [];
  for (const c of GATE_FAIL_CODE_ORDER) {
    if (set.has(c)) out.push(c);
  }
  for (const c of set) {
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

function isWeightedScoreFailCode(code: string): boolean {
  return code === 'weighted_score';
}

/**
 * When the interview gate fails, `gate_fail_reasons` must never be empty.
 * Backfills `weighted_score` (and detail) when score is below threshold but no code was recorded.
 */
export function ensureGateFailReasonsForFailedInterviewGate(opts: {
  gateFailReasons: string[];
  depthSignalModifiedScore: number | null;
  finalModifiedScoreWithPsychometrics?: number | null;
  weightedPassMin?: number;
  finalGatePass: boolean;
  gateFailDetail?: Record<string, unknown> | null;
}): { gateFailReasons: string[]; gateFailDetail: Record<string, unknown> } {
  const weightedMin = opts.weightedPassMin ?? GATE_PASS_WEIGHTED_MIN;
  const detail =
    opts.gateFailDetail != null && typeof opts.gateFailDetail === 'object' && !Array.isArray(opts.gateFailDetail)
      ? { ...opts.gateFailDetail }
      : {};

  let reasons = [...opts.gateFailReasons];

  const depthScore =
    typeof opts.depthSignalModifiedScore === 'number' && Number.isFinite(opts.depthSignalModifiedScore)
      ? opts.depthSignalModifiedScore
      : null;
  const psychScore =
    typeof opts.finalModifiedScoreWithPsychometrics === 'number' &&
    Number.isFinite(opts.finalModifiedScoreWithPsychometrics)
      ? opts.finalModifiedScoreWithPsychometrics
      : null;

  const scoreBelowInterviewThreshold = depthScore != null && depthScore < weightedMin;
  const scoreBelowPsychometricThreshold = psychScore != null && psychScore < weightedMin;

  if (scoreBelowInterviewThreshold && !reasons.some(isWeightedScoreFailCode)) {
    reasons.push('weighted_score');
  }
  if (
    scoreBelowPsychometricThreshold &&
    psychScore !== depthScore &&
    !reasons.some(isWeightedScoreFailCode)
  ) {
    reasons.push('weighted_score');
  }

  if (!opts.finalGatePass && reasons.length === 0) {
    reasons.push('weighted_score');
  }

  reasons = [...new Set(reasons)];

  if (reasons.some(isWeightedScoreFailCode)) {
    const scoreForDetail = psychScore ?? depthScore;
    if (scoreForDetail != null) {
      detail.weighted_score = { score: scoreForDetail, requiredMin: GATE_PASS_WEIGHTED_MIN };
    }
  }

  return { gateFailReasons: reasons, gateFailDetail: detail };
}
