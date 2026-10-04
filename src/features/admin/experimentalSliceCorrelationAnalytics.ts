import {
  EXPERIMENTAL_SLICE_CORRELATION_REVIEW_ABS_R,
  EXPERIMENTAL_SLICE_PAIR_CORRELATIONS,
  type ExperimentalInterviewSliceId,
} from '@config/scoring/experimentalInterviewSlices';
import { pearsonR } from '@features/admin/scoringStats';

export type SlicePairObservation = {
  pairId: string;
  a: ExperimentalInterviewSliceId;
  b: ExperimentalInterviewSliceId;
  n: number;
  r: number | null;
  reviewFlag: boolean;
};

/**
 * Correlation review for experimental slices.
 * `|r| >= 0.70` is a review flag only — never an automatic merge/delete rule.
 */
export function evaluateExperimentalSlicePairCorrelations(
  rows: Array<Partial<Record<ExperimentalInterviewSliceId, number | null | undefined>>>,
): SlicePairObservation[] {
  return EXPERIMENTAL_SLICE_PAIR_CORRELATIONS.map((pair) => {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const row of rows) {
      const a = row[pair.a];
      const b = row[pair.b];
      if (typeof a === 'number' && Number.isFinite(a) && typeof b === 'number' && Number.isFinite(b)) {
        xs.push(a);
        ys.push(b);
      }
    }
    const r = pearsonR(xs, ys);
    return {
      pairId: pair.id,
      a: pair.a,
      b: pair.b,
      n: xs.length,
      r,
      reviewFlag: r != null && Math.abs(r) >= EXPERIMENTAL_SLICE_CORRELATION_REVIEW_ABS_R,
    };
  });
}
