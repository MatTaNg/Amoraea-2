import {
  INTERVIEW_MARKER_IDS,
  INTERVIEW_MARKER_LABELS,
  type InterviewMarkerId,
} from './interviewMarkers.ts';

/** Research-based weights (sum = 1.0). Renormalized over assessed constructs only. */
export const GATE_MARKER_BASE_WEIGHTS: Record<InterviewMarkerId, number> = {
  contempt: 0.2,
  accountability: 0.18,
  repair: 0.18,
  regulation: 0.12,
  attunement: 0.12,
  mentalizing: 0.1,
  commitment_threshold: 0.05,
  appreciation: 0.05,
};

/** Minimum score for an assessed construct; omitted = no floor. */
export const GATE_MARKER_FLOORS: Partial<Record<InterviewMarkerId, number>> = {
  contempt: 5.0,
  accountability: 4.5,
  repair: 4.5,
  regulation: 4.0,
};

export const GATE_PASS_WEIGHTED_MIN = 6.0;

export type GateResultReason =
  | 'pass'
  | 'floor_breach'
  | 'weighted_below_threshold'
  | 'no_assessed_markers';

export interface GateResult {
  pass: boolean;
  reason: GateResultReason;
  weightedScore: number | null;
  failingConstruct: string | null;
  failingScore: number | null;
  assessedMarkerCount: number;
  excludedMarkers: string[];
  failReason: string | null;
}

export type ComputeGateResultOptions = {
  /** App-only: e.g. remote logging. Omitted in Node scripts. */
  onWeightedBreakdown?: (data: Record<string, unknown>) => void;
  /** Overrides {@link GATE_PASS_WEIGHTED_MIN} for weighted average only (e.g. referral boost). Floors unchanged. */
  weightedPassMin?: number;
};

/** Weighted pass threshold when referral boost is active (floors unchanged). */
export const REFERRAL_WEIGHTED_PASS_MIN = 5.5;

function isAssessedScore(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function formatFloorBreachFailReason(
  breaches: Array<{ id: InterviewMarkerId; score: number }>,
): string {
  const sorted = [...breaches].sort((a, b) => a.id.localeCompare(b.id));
  const parts = sorted.map((b) => `${b.id} (${b.score.toFixed(1)})`);
  return `floor_breach: ${parts.join(', ')}`;
}

/**
 * Gate pass/fail (pure): renormalized weights, floors, weighted average threshold.
 * Use {@link computeGateResult} in the app when remote breakdown logging is desired.
 */
export function computeGateResultCore(
  pillarScores: Record<string, number | null | undefined>,
  skepticismModifier?: { pillarId: number | string | null; adjustment: number; reason?: string } | null,
  options?: ComputeGateResultOptions,
): GateResult {
  const adjustedScores: Record<string, number | undefined> = { ...pillarScores } as Record<string, number | undefined>;
  if (skepticismModifier && skepticismModifier.pillarId != null && skepticismModifier.adjustment !== 0) {
    const id = String(skepticismModifier.pillarId);
    const current = adjustedScores[id];
    if (current !== undefined) {
      adjustedScores[id] = Math.min(9, Math.max(2, current + skepticismModifier.adjustment));
    }
  }

  const assessedMarkerIds = INTERVIEW_MARKER_IDS.filter((id) => isAssessedScore(adjustedScores[id]));
  const excludedMarkers = INTERVIEW_MARKER_IDS.filter((id) => !assessedMarkerIds.includes(id));

  const emptyResult = (reason: GateResultReason, failReason: string | null): GateResult => ({
    pass: false,
    reason,
    weightedScore: null,
    failingConstruct: null,
    failingScore: null,
    assessedMarkerCount: 0,
    excludedMarkers,
    failReason,
  });

  if (assessedMarkerIds.length === 0) {
    return emptyResult('no_assessed_markers', 'no_assessed_markers: no construct scored above 0');
  }

  const weightSumAssessed = assessedMarkerIds.reduce(
    (sum, id) => sum + GATE_MARKER_BASE_WEIGHTS[id],
    0,
  );
  if (weightSumAssessed <= 0) {
    return emptyResult('no_assessed_markers', 'no_assessed_markers: zero nominal weight sum');
  }

  const floorBreaches: Array<{ id: InterviewMarkerId; score: number }> = [];
  for (const id of assessedMarkerIds) {
    const floor = GATE_MARKER_FLOORS[id];
    if (floor === undefined) continue;
    const score = adjustedScores[id] as number;
    if (score < floor) {
      floorBreaches.push({ id, score });
    }
  }

  let weightedSum = 0;
  const contributions: Array<{
    marker: string;
    score: number;
    baseWeight: number;
    effectiveWeight: number;
    weightedContribution: number;
  }> = [];

  assessedMarkerIds.forEach((id) => {
    const baseW = GATE_MARKER_BASE_WEIGHTS[id];
    const effectiveW = baseW / weightSumAssessed;
    const raw = adjustedScores[id];
    const score = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    const weightedContribution = score * effectiveW;
    weightedSum += weightedContribution;
    contributions.push({
      marker: id,
      score,
      baseWeight: baseW,
      effectiveWeight: effectiveW,
      weightedContribution,
    });
  });

  const weightedScore = Math.round(weightedSum * 10) / 10;
  const weightedMin = options?.weightedPassMin ?? GATE_PASS_WEIGHTED_MIN;
  const meetsWeightedThreshold = weightedSum >= weightedMin;
  let simpleSum = 0;
  assessedMarkerIds.forEach((id) => {
    simpleSum += (adjustedScores[id] as number) ?? 0;
  });
  const simpleAverage = simpleSum / assessedMarkerIds.length;
  const weightedVsSimpleDelta = Math.round((weightedScore - simpleAverage) * 1000) / 1000;

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[WEIGHTED_SCORE_BREAKDOWN]', {
      contributions,
      weightSumAssessed,
      simpleAverage: Math.round(simpleAverage * 1000) / 1000,
      weightedScore,
      weightedVsSimpleDelta,
    });
  }
  options?.onWeightedBreakdown?.({
    contributions,
    weightSumAssessed,
    assessedMarkerCount: assessedMarkerIds.length,
    excludedMarkers,
    simpleAverage: Math.round(simpleAverage * 1000) / 1000,
    weightedScore,
    weightedVsSimpleDelta,
  });

  if (floorBreaches.length > 0) {
    const first = floorBreaches.slice().sort((a, b) => a.id.localeCompare(b.id))[0];
    return {
      pass: false,
      reason: 'floor_breach',
      weightedScore,
      failingConstruct: INTERVIEW_MARKER_LABELS[first.id] ?? first.id,
      failingScore: first.score,
      assessedMarkerCount: assessedMarkerIds.length,
      excludedMarkers,
      failReason: formatFloorBreachFailReason(floorBreaches),
    };
  }

  if (!meetsWeightedThreshold) {
    return {
      pass: false,
      reason: 'weighted_below_threshold',
      weightedScore,
      failingConstruct: null,
      failingScore: null,
      assessedMarkerCount: assessedMarkerIds.length,
      excludedMarkers,
      failReason: `weighted_below_threshold: ${weightedScore.toFixed(1)} (required ${weightedMin.toFixed(1)})`,
    };
  }

  return {
    pass: true,
    reason: 'pass',
    weightedScore,
    failingConstruct: null,
    failingScore: null,
    assessedMarkerCount: assessedMarkerIds.length,
    excludedMarkers,
    failReason: null,
  };
}
