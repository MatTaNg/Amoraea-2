import { INTERVIEW_MARKER_IDS } from './interviewMarkers';
import { isNoEvidenceText, isNotAssessedDueToTechnicalInterruption, normalizeScoresByEvidence } from './probeAndScoringUtils';

export type MarkerScoreSlice = {
  pillarScores?: Record<string, number | null> | null;
  keyEvidence?: Record<string, string> | null;
} | null | undefined;

export type PillarMomentLabel =
  | 'scenario_1'
  | 'scenario_2'
  | 'scenario_3'
  | 'moment_4';

export type LabeledMarkerSlice = {
  moment: PillarMomentLabel;
  pillarScores?: Record<string, number | null | undefined> | null;
  keyEvidence?: Record<string, string> | null;
};

const SLICE_LABELS: PillarMomentLabel[] = ['scenario_1', 'scenario_2', 'scenario_3', 'moment_4'];

type StandardMarkerId = Exclude<
  (typeof INTERVIEW_MARKER_IDS)[number],
  'contempt' | 'commitment_threshold'
>;

/** Which interview moments may contribute numeric evidence to each pillar aggregate. */
const STANDARD_MARKER_ALLOWED_MOMENTS: Record<StandardMarkerId, Set<PillarMomentLabel>> = {
  repair: new Set(['scenario_1', 'scenario_2', 'scenario_3']),
  attunement: new Set(['scenario_1', 'scenario_2', 'scenario_3']),
  regulation: new Set(['scenario_3']),
  mentalizing: new Set(SLICE_LABELS),
  appreciation: new Set(['scenario_2']),
  accountability: new Set(['scenario_1', 'scenario_2', 'scenario_3', 'moment_4']),
};

/** Contempt pillar: 60% pooled expression + 40% pooled recognition. */
const CONTEMPT_EXPRESSION_WEIGHT = 0.6;
const CONTEMPT_RECOGNITION_WEIGHT = 0.4;

/** First-person Moment 4 vs fictional Scenario C — not equivalent evidence for commitment threshold. */
const COMMITMENT_THRESHOLD_WEIGHT_MOMENT4 = 0.6;
const COMMITMENT_THRESHOLD_WEIGHT_SCENARIO3 = 0.4;

function scoredValue(
  pillarScores: Record<string, number | null | undefined> | null | undefined,
  keyEvidence: Record<string, string> | null | undefined,
  key: string
): number | null {
  if (!pillarScores) return null;
  const raw = pillarScores[key];
  if (isNotAssessedDueToTechnicalInterruption(keyEvidence?.[key])) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  if (isNoEvidenceText(keyEvidence?.[key])) return null;
  return raw;
}

function contemptExpressionForRow(row: LabeledMarkerSlice): number | null {
  const explicit = scoredValue(row.pillarScores, row.keyEvidence, 'contempt_expression');
  if (explicit != null) return explicit;
  const legacy = scoredValue(row.pillarScores, row.keyEvidence, 'contempt');
  if (legacy == null) return null;
  // Legacy monolithic `contempt` on Scenario A blended recognition reads; do not treat as participant expression.
  if (row.moment === 'scenario_1') return null;
  return legacy;
}

function averageNonNull(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export function commitmentThresholdFromSlice(slice: MarkerScoreSlice): number | null {
  if (!slice?.pillarScores) return null;
  const filtered = normalizeScoresByEvidence(slice.pillarScores, slice.keyEvidence);
  const v = filtered.commitment_threshold;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Overrides `commitment_threshold` on aggregated scores: 60% Moment 4 + 40% Scenario C when both
 * have assessable values; Moment 4 only or Scenario C only when the other is missing; leaves
 * aggregated value unchanged only when neither slice contributes (caller may omit keys).
 */
export function mergeCommitmentThresholdWeighted(
  aggregated: Record<string, number>,
  scenario3Slice: MarkerScoreSlice,
  moment4Slice: MarkerScoreSlice
): Record<string, number> {
  const s3 = commitmentThresholdFromSlice(scenario3Slice);
  const m4 = commitmentThresholdFromSlice(moment4Slice);
  if (s3 == null && m4 == null) return aggregated;
  let ct: number;
  if (m4 != null && s3 != null) {
    ct = COMMITMENT_THRESHOLD_WEIGHT_MOMENT4 * m4 + COMMITMENT_THRESHOLD_WEIGHT_SCENARIO3 * s3;
  } else if (m4 != null) {
    ct = m4;
  } else {
    ct = s3 as number;
  }
  return {
    ...aggregated,
    commitment_threshold: Math.round(ct * 10) / 10,
  };
}

/**
 * Single-scenario contempt for analytics / `score_consistency`: matches aggregate pillar logic —
 * 60% expression + 40% recognition when both exist; otherwise the available sub-score or legacy
 * monolithic `contempt` (older Scenario A rows).
 */
export function combinedContemptFromScenarioPillarScores(
  pillarScores: Record<string, number | null | undefined> | null | undefined,
  keyEvidence?: Record<string, string> | null
): number | null {
  if (!pillarScores) return null;
  const numOrNull = (
    key: 'contempt_expression' | 'contempt_recognition' | 'contempt',
    raw: number | null | undefined
  ): number | null => {
    if (isNotAssessedDueToTechnicalInterruption(keyEvidence?.[key])) return null;
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  };
  const expr = numOrNull('contempt_expression', pillarScores.contempt_expression);
  const rec = numOrNull('contempt_recognition', pillarScores.contempt_recognition);
  const legacy = numOrNull('contempt', pillarScores.contempt);

  if (expr != null && rec != null) {
    return (
      Math.round((CONTEMPT_EXPRESSION_WEIGHT * expr + CONTEMPT_RECOGNITION_WEIGHT * rec) * 10) / 10
    );
  }
  if (expr != null) return expr;
  if (rec != null) return rec;
  if (legacy != null) return legacy;
  return null;
}

export type MomentRestrictedAggregateResult = {
  scores: Record<string, number>;
  /** Count of moment-level numeric samples averaged into each pillar (contempt: 1–2 when combined from sub-pools). */
  contributorCounts: Record<string, number>;
};

export function aggregateMarkerScoresFromLabeledSlices(
  rows: LabeledMarkerSlice[]
): MomentRestrictedAggregateResult {
  const out: Record<string, number> = {};
  const contributorCounts: Record<string, number> = {};

  for (const id of INTERVIEW_MARKER_IDS) {
    if (id === 'contempt' || id === 'commitment_threshold') continue;
    const allowed = STANDARD_MARKER_ALLOWED_MOMENTS[id];
    const vals: number[] = [];
    for (const row of rows) {
      if (!allowed.has(row.moment)) continue;
      const v = scoredValue(row.pillarScores, row.keyEvidence, id);
      if (v != null) vals.push(v);
    }
    const avg = averageNonNull(vals);
    if (avg !== undefined) {
      out[id] = avg;
      contributorCounts[id] = vals.length;
    }
  }

  const expressionVals: number[] = [];
  const recognitionVals: number[] = [];
  for (const row of rows) {
    // Pooled contempt **expression** uses fictional scenario slices only — personal moments must not
    // dilute harsh vignette framing (M4 can read as low contempt for unrelated reasons).
    if (
      row.moment === 'scenario_1' ||
      row.moment === 'scenario_2' ||
      row.moment === 'scenario_3'
    ) {
      const ex = contemptExpressionForRow(row);
      if (ex != null) expressionVals.push(ex);
    }

    if (row.moment === 'scenario_1' || row.moment === 'moment_4') {
      const recExplicit = scoredValue(row.pillarScores, row.keyEvidence, 'contempt_recognition');
      if (recExplicit != null) {
        recognitionVals.push(recExplicit);
      } else if (row.moment === 'scenario_1') {
        const legacy = scoredValue(row.pillarScores, row.keyEvidence, 'contempt');
        if (legacy != null) recognitionVals.push(legacy);
      }
    }
  }

  const eAvg = averageNonNull(expressionVals);
  const rAvg = averageNonNull(recognitionVals);
  let contemptScore: number | undefined;
  if (eAvg !== undefined && rAvg !== undefined) {
    contemptScore =
      Math.round(
        (CONTEMPT_EXPRESSION_WEIGHT * eAvg + CONTEMPT_RECOGNITION_WEIGHT * rAvg) * 10
      ) / 10;
    contributorCounts.contempt = 2;
  } else if (eAvg !== undefined) {
    contemptScore = eAvg;
    contributorCounts.contempt = 1;
  } else if (rAvg !== undefined) {
    contemptScore = rAvg;
    contributorCounts.contempt = 1;
  }
  if (contemptScore !== undefined) out.contempt = contemptScore;

  return { scores: out, contributorCounts };
}

export function aggregateMarkerScoresFromSlicesDetailed(
  slices: Array<MarkerScoreSlice | null | undefined>
): MomentRestrictedAggregateResult {
  const rows: LabeledMarkerSlice[] = SLICE_LABELS.map((moment, i) => ({
    moment,
    pillarScores: slices[i]?.pillarScores ?? undefined,
    keyEvidence: slices[i]?.keyEvidence ?? undefined,
  }));
  return aggregateMarkerScoresFromLabeledSlices(rows);
}

/** @deprecated Prefer {@link aggregateMarkerScoresFromSlicesDetailed} when counts are needed. */
export function aggregateMarkerScoresFromSlices(
  slices: Array<MarkerScoreSlice | null | undefined>
): Record<string, number> {
  return aggregateMarkerScoresFromSlicesDetailed(slices).scores;
}

export function aggregatePillarScoresWithCommitmentMergeDetailed(
  slices: Array<MarkerScoreSlice | null | undefined>
): MomentRestrictedAggregateResult {
  const { scores: base, contributorCounts } = aggregateMarkerScoresFromSlicesDetailed(slices);
  const merged = mergeCommitmentThresholdWeighted(base, slices[2], slices[3]);
  let ctCount = 0;
  if (commitmentThresholdFromSlice(slices[2]) != null) ctCount += 1;
  if (commitmentThresholdFromSlice(slices[3]) != null) ctCount += 1;
  return {
    scores: merged,
    contributorCounts: {
      ...contributorCounts,
      commitment_threshold: ctCount > 0 ? ctCount : merged.commitment_threshold != null ? 1 : 0,
    },
  };
}

/** Pillar map after moment rules + commitment merge (live interview, reprocess scripts, admin). */
export function aggregatePillarScoresWithCommitmentMerge(
  slices: Array<MarkerScoreSlice | null | undefined>
): Record<string, number> {
  return aggregatePillarScoresWithCommitmentMergeDetailed(slices).scores;
}
