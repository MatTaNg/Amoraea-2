export {
  SKIP_PENALTY_FIRST,
  SKIP_PENALTY_SECOND,
} from '@config/scoring/interviewSkipPenalties';

import {
  SKIP_PENALTY_FIRST,
  SKIP_PENALTY_SECOND,
} from '@config/scoring/interviewSkipPenalties';

/** When user skips after first frustration offer — force null markers (excluded from aggregates), not zero. */
export const SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS: Record<1 | 2 | 3, string[]> = {
  1: ['mentalizing', 'accountability', 'contempt_recognition', 'contempt_expression', 'repair', 'attunement', 'appreciation'],
  2: ['appreciation', 'attunement', 'mentalizing', 'repair', 'accountability', 'contempt_expression'],
  3: ['regulation', 'repair', 'mentalizing', 'attunement', 'accountability', 'contempt_expression'],
};

export function individualPenaltyForSkipNumber(skipNumber: 1 | 2 | 3): number | null {
  if (skipNumber === 1) return SKIP_PENALTY_FIRST;
  if (skipNumber === 2) return SKIP_PENALTY_SECOND;
  return null;
}

/** Stored penalty entries; third skip records `null` (auto-fail — no numeric deduction). */
export function buildSkipPenaltiesArray(skipCount: number): (number | null)[] {
  const out: (number | null)[] = [];
  if (skipCount >= 1) out.push(SKIP_PENALTY_FIRST);
  if (skipCount >= 2) out.push(SKIP_PENALTY_SECOND);
  if (skipCount >= 3) out.push(null);
  return out;
}

/** Sum of numeric penalties only (excludes third skip). */
export function sumSkipPenalties(skipPenalties: (number | null)[]): number {
  let s = 0;
  for (const p of skipPenalties) {
    if (typeof p === 'number' && Number.isFinite(p)) s += p;
  }
  return Math.round(s * 100) / 100;
}

export type SkipPenaltyGateComputation = {
  skipPenaltyTotal: number;
  skipAutoFail: boolean;
  skip_penalties: (number | null)[];
  skip_penalty_total: number;
  skips_taken: number;
};

/**
 * Values passed into {@link computeGateResultCore} after marker aggregation.
 * Third skip: numeric penalties stay at sum of first two; auto-fail zeros weighted output in gate core.
 */
export function computeSkipPenaltyGateComputation(skipCount: number): SkipPenaltyGateComputation {
  const capped = Math.max(0, Math.min(3, Math.floor(skipCount)));
  const skip_penalties = buildSkipPenaltiesArray(capped);
  const skip_penalty_total = sumSkipPenalties(skip_penalties);
  const skipAutoFail = capped >= 3;
  return {
    skipPenaltyTotal: skip_penalty_total,
    skipAutoFail,
    skip_penalties,
    skip_penalty_total,
    skips_taken: capped,
  };
}
