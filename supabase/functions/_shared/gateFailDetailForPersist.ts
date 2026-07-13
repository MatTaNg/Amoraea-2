import { GATE_PASS_WEIGHTED_MIN } from '../../../src/config/scoring/interviewGateThresholds.ts';
import type { GateFailDetailJson } from './computeGateResultCore.ts';

/** Minimum shape for `interview_attempts.gate_fail_detail` — never persist null. */
export const EMPTY_GATE_FAIL_DETAIL_FOR_PERSIST: Record<string, unknown> = {
  psychometric_floors: {},
};

function canonicalizeWeightedScoreDetail(
  weightedScore: unknown,
): Record<string, unknown> | undefined {
  if (weightedScore == null || typeof weightedScore !== 'object' || Array.isArray(weightedScore)) {
    return undefined;
  }
  const row = weightedScore as Record<string, unknown>;
  const score = row.score;
  if (typeof score !== 'number' || !Number.isFinite(score)) return undefined;
  return { score, requiredMin: GATE_PASS_WEIGHTED_MIN };
}

/**
 * Normalize gate_fail_detail before DB persist.
 * Ensures `psychometric_floors` is always a keyed object (never null / legacy string[]).
 * Ensures `weighted_score.requiredMin` always reflects the canonical pass threshold (6.5).
 */
export function normalizeGateFailDetailForPersist(
  detail: GateFailDetailJson | Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const base =
    detail != null && typeof detail === 'object' && !Array.isArray(detail)
      ? { ...(detail as Record<string, unknown>) }
      : {};
  const psych = base.psychometric_floors;
  if (psych == null || Array.isArray(psych) || typeof psych !== 'object') {
    base.psychometric_floors = {};
  }
  const canonicalWeighted = canonicalizeWeightedScoreDetail(base.weighted_score);
  if (canonicalWeighted) {
    base.weighted_score = canonicalWeighted;
  }
  return base;
}
