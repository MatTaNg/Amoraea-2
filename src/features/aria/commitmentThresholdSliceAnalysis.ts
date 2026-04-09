import { normalizeScoresByEvidence } from '@features/aria/probeAndScoringUtils';

export type MarkerScoreSlice = {
  pillarScores?: Record<string, number | null> | null;
  keyEvidence?: Record<string, string> | null;
} | null | undefined;

/** Sample standard deviation (n >= 2), Bessel's correction. */
export function sampleStdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sumSq = values.reduce((s, x) => s + (x - mean) ** 2, 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

export type CommitmentThresholdInconsistencyPayload = {
  standardDeviation: number;
  sliceScores: number[];
  evidenceSnippets: { label: string; text: string }[];
};

const INCONSISTENCY_STD_THRESHOLD = 3.0;

/** Inconsistency is defined between Scenario C fiction vs Moment 4 first-person only (weighted-combine sources). */
const COMMITMENT_INCONSISTENCY_SLICE_LABELS = new Set(['scenario_3', 'moment_4']);

export function analyzeCommitmentThresholdInconsistency(
  slices: MarkerScoreSlice[],
  labels: string[]
): CommitmentThresholdInconsistencyPayload | null {
  const values: number[] = [];
  const snippets: { label: string; text: string }[] = [];

  slices.forEach((slice, i) => {
    if (!slice?.pillarScores) return;
    const label = labels[i] ?? `slice_${i}`;
    if (!COMMITMENT_INCONSISTENCY_SLICE_LABELS.has(label)) return;
    const filtered = normalizeScoresByEvidence(slice.pillarScores, slice.keyEvidence);
    const v = filtered.commitment_threshold;
    if (typeof v !== 'number' || !Number.isFinite(v)) return;
    values.push(v);
    const ev = slice.keyEvidence?.commitment_threshold?.trim() ?? '';
    snippets.push({
      label,
      text: ev ? `${label} (score ${v}): ${ev.slice(0, 500)}` : `${label}: score ${v}`,
    });
  });

  const std = sampleStdDev(values);
  if (std == null || std <= INCONSISTENCY_STD_THRESHOLD) return null;

  return {
    standardDeviation: Math.round(std * 1000) / 1000,
    sliceScores: values,
    evidenceSnippets: snippets,
  };
}
