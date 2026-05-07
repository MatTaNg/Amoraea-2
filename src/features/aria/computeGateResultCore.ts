import {
  INTERVIEW_MARKER_IDS,
  INTERVIEW_MARKER_LABELS,
  type InterviewMarkerId,
} from './interviewMarkers';
import {
  buildScenarioCompositesTriple,
  formatScenarioFloorFailReason,
  scenarioFloorBreaches,
  type ScenarioCompositesTriple,
  type ScenarioGateIndex as ScenarioCompositeGateIndex,
} from './scenarioCompositeFloor';
import {
  formatMentalizingRepairFloorSnippet,
  mentalizingRepairFloorTriggered,
  type ScenarioPillarLow,
} from './mentalizingRepairScenarioFloor';

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
  | 'scenario_floor'
  | 'mentalizing_floor'
  | 'repair_floor'
  | 'no_assessed_markers'
  | 'incomplete_interview';

/** Stored on `interview_attempts.gate_fail_reasons`; multiple can apply at once. */
export type GateFailCode = 'weighted_score' | 'scenario_floor' | 'mentalizing_floor' | 'repair_floor';

export type GateFailDetailJson = {
  weighted_score?: { score: number; requiredMin: number };
  scenario_floor?: {
    composites: ScenarioCompositesTriple;
    breaches: Array<{ scenario: ScenarioCompositeGateIndex; composite: number }>;
  };
  mentalizing_floor?: { lowScenarios: ScenarioPillarLow[] };
  repair_floor?: { lowScenarios: ScenarioPillarLow[] };
};

export interface GateResult {
  pass: boolean;
  reason: GateResultReason;
  weightedScore: number | null;
  /** Marker-only weighted average before scenario skip penalties / auto-fail (omit when same as {@link weightedScore}). */
  markerWeightedScore?: number | null;
  failingConstruct: string | null;
  failingScore: number | null;
  assessedMarkerCount: number;
  excludedMarkers: string[];
  /** Semicolon-joined summary for logs and legacy readers. */
  failReason: string | null;
  /** All gate failures that apply (excluding holistic pillar `floor_breach`). */
  failReasonCodes?: GateFailCode[];
  /** Structured detail aligned with {@link failReasonCodes}. */
  failReasonDetail?: GateFailDetailJson | null;
  /** Present when per-scenario pillar maps were supplied (standard interview scenarios 1–3 only). */
  scenarioComposites?: ScenarioCompositesTriple | null;
}

export type ComputeGateResultOptions = {
  /** App-only: e.g. remote logging. Omitted in Node scripts. */
  onWeightedBreakdown?: (data: Record<string, unknown>) => void;
  /** Overrides {@link GATE_PASS_WEIGHTED_MIN} for weighted average only (e.g. referral boost). Floors unchanged. */
  weightedPassMin?: number;
  /** Sum of skip penalties (negative), applied after marker weighted score. Omit if no skips. */
  skipPenaltyTotal?: number;
  /** Third skip: final weighted score forced to 0 and gate fails (floors still from markers only). */
  skipAutoFail?: boolean;
  /**
   * When set, after weighted threshold passes, each scenario’s composite (mean of present pillar scores in that
   * scenario’s slice) must be ≥ 4.5. Omit for holistic-only / scripts.
   */
  scenarioPillarScoresByScenario?: Partial<
    Record<1 | 2 | 3, Record<string, number | null | undefined> | null | undefined>
  >;
};

/** Weighted pass threshold when referral boost is active (floors unchanged). */
export const REFERRAL_WEIGHTED_PASS_MIN = 5.5;

const GATE_FAIL_CODE_ORDER: GateFailCode[] = [
  'weighted_score',
  'scenario_floor',
  'mentalizing_floor',
  'repair_floor',
];

function pickPrimaryGateReason(codes: GateFailCode[]): GateResultReason {
  for (const o of GATE_FAIL_CODE_ORDER) {
    if (codes.includes(o)) {
      if (o === 'weighted_score') return 'weighted_below_threshold';
      return o;
    }
  }
  return 'weighted_below_threshold';
}

function pickPrimaryFailingConstructAndScore(
  codes: GateFailCode[],
  detail: GateFailDetailJson,
): { failingConstruct: string | null; failingScore: number | null } {
  for (const o of GATE_FAIL_CODE_ORDER) {
    if (!codes.includes(o)) continue;
    if (o === 'weighted_score' && detail.weighted_score) {
      return { failingConstruct: null, failingScore: detail.weighted_score.score };
    }
    if (o === 'scenario_floor' && detail.scenario_floor?.breaches[0]) {
      const b = detail.scenario_floor.breaches[0]!;
      return {
        failingConstruct: `Scenario ${b.scenario} composite`,
        failingScore: b.composite,
      };
    }
    if (o === 'mentalizing_floor' && detail.mentalizing_floor?.lowScenarios[0]) {
      const l = detail.mentalizing_floor.lowScenarios[0]!;
      return {
        failingConstruct: `Mentalizing scenario ${l.scenario}`,
        failingScore: l.score,
      };
    }
    if (o === 'repair_floor' && detail.repair_floor?.lowScenarios[0]) {
      const l = detail.repair_floor.lowScenarios[0]!;
      return {
        failingConstruct: `Repair scenario ${l.scenario}`,
        failingScore: l.score,
      };
    }
  }
  return { failingConstruct: null, failingScore: null };
}

function formatAggregateGateFailReason(
  codes: GateFailCode[],
  detail: GateFailDetailJson,
  weightedScore: number,
  weightedMin: number,
): string {
  const parts: string[] = [];
  for (const c of GATE_FAIL_CODE_ORDER) {
    if (!codes.includes(c)) continue;
    if (c === 'weighted_score') {
      parts.push(`weighted_score: ${weightedScore.toFixed(1)} (required ${weightedMin.toFixed(1)})`);
    }
    if (c === 'scenario_floor' && detail.scenario_floor?.breaches.length) {
      parts.push(formatScenarioFloorFailReason(detail.scenario_floor.breaches, true));
    }
    if (c === 'mentalizing_floor' && detail.mentalizing_floor?.lowScenarios.length) {
      parts.push(formatMentalizingRepairFloorSnippet('mentalizing_floor', detail.mentalizing_floor.lowScenarios));
    }
    if (c === 'repair_floor' && detail.repair_floor?.lowScenarios.length) {
      parts.push(formatMentalizingRepairFloorSnippet('repair_floor', detail.repair_floor.lowScenarios));
    }
  }
  return parts.join('; ');
}

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

  const markerWeightedScore = Math.round(weightedSum * 10) / 10;
  const skipPenaltyTotal = options?.skipPenaltyTotal ?? 0;
  const skipAutoFail = options?.skipAutoFail ?? false;
  const finalWeightedScore = skipAutoFail
    ? 0
    : Math.round((markerWeightedScore + skipPenaltyTotal) * 10) / 10;
  const weightedMin = options?.weightedPassMin ?? GATE_PASS_WEIGHTED_MIN;
  const meetsWeightedThreshold = !skipAutoFail && finalWeightedScore >= weightedMin;
  let simpleSum = 0;
  assessedMarkerIds.forEach((id) => {
    simpleSum += (adjustedScores[id] as number) ?? 0;
  });
  const simpleAverage = simpleSum / assessedMarkerIds.length;
  const weightedVsSimpleDelta = Math.round((markerWeightedScore - simpleAverage) * 1000) / 1000;

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[WEIGHTED_SCORE_BREAKDOWN]', {
      contributions,
      weightSumAssessed,
      simpleAverage: Math.round(simpleAverage * 1000) / 1000,
      weightedScore: markerWeightedScore,
      weightedVsSimpleDelta,
    });
  }
  options?.onWeightedBreakdown?.({
    contributions,
    weightSumAssessed,
    assessedMarkerCount: assessedMarkerIds.length,
    excludedMarkers,
    simpleAverage: Math.round(simpleAverage * 1000) / 1000,
    weightedScore: markerWeightedScore,
    weightedVsSimpleDelta,
  });

  const scenarioMaps = options?.scenarioPillarScoresByScenario;
  let scenarioComposites: ScenarioCompositesTriple | null = null;
  let scenarioFloorGateDetail: GateFailDetailJson | null = null;
  if (scenarioMaps != null) {
    scenarioComposites = buildScenarioCompositesTriple(scenarioMaps);
    const sb = scenarioFloorBreaches(scenarioComposites);
    if (sb.length > 0) {
      scenarioFloorGateDetail = {
        scenario_floor: { composites: scenarioComposites, breaches: sb },
      };
    }
  }

  if (floorBreaches.length > 0) {
    const first = floorBreaches.slice().sort((a, b) => a.id.localeCompare(b.id))[0];
    return {
      pass: false,
      reason: 'floor_breach',
      weightedScore: markerWeightedScore,
      failingConstruct: INTERVIEW_MARKER_LABELS[first.id] ?? first.id,
      failingScore: first.score,
      assessedMarkerCount: assessedMarkerIds.length,
      excludedMarkers,
      failReason: formatFloorBreachFailReason(floorBreaches),
      scenarioComposites,
      failReasonCodes: scenarioFloorGateDetail ? ['scenario_floor'] : undefined,
      failReasonDetail: scenarioFloorGateDetail,
    };
  }

  const codes: GateFailCode[] = [];
  const detail: GateFailDetailJson = {};

  if (!meetsWeightedThreshold) {
    codes.push('weighted_score');
    detail.weighted_score = { score: finalWeightedScore, requiredMin: weightedMin };
  }

  if (scenarioFloorGateDetail) {
    codes.push('scenario_floor');
    Object.assign(detail, scenarioFloorGateDetail);
  }

  if (scenarioMaps != null) {
    const mr = mentalizingRepairFloorTriggered(scenarioMaps);
    if (mr.mentalizingFloorFails) {
      codes.push('mentalizing_floor');
      detail.mentalizing_floor = { lowScenarios: mr.mentalizingLowScenarios };
    }
    if (mr.repairFloorFails) {
      codes.push('repair_floor');
      detail.repair_floor = { lowScenarios: mr.repairLowScenarios };
    }
  }

  const markerWeightedScoreField =
    skipAutoFail || skipPenaltyTotal !== 0 ? markerWeightedScore : undefined;

  if (codes.length > 0) {
    const primary = pickPrimaryGateReason(codes);
    const { failingConstruct, failingScore } = pickPrimaryFailingConstructAndScore(codes, detail);
    return {
      pass: false,
      reason: primary,
      weightedScore: finalWeightedScore,
      ...(markerWeightedScoreField != null ? { markerWeightedScore: markerWeightedScoreField } : {}),
      failingConstruct,
      failingScore,
      assessedMarkerCount: assessedMarkerIds.length,
      excludedMarkers,
      failReason: formatAggregateGateFailReason(codes, detail, finalWeightedScore, weightedMin),
      failReasonCodes: codes,
      failReasonDetail: detail,
      scenarioComposites,
    };
  }

  if (scenarioMaps != null) {
    return {
      pass: true,
      reason: 'pass',
      weightedScore: finalWeightedScore,
      ...(markerWeightedScoreField != null ? { markerWeightedScore: markerWeightedScoreField } : {}),
      failingConstruct: null,
      failingScore: null,
      assessedMarkerCount: assessedMarkerIds.length,
      excludedMarkers,
      failReason: null,
      failReasonCodes: [],
      failReasonDetail: null,
      scenarioComposites,
    };
  }

  return {
    pass: true,
    reason: 'pass',
    weightedScore: finalWeightedScore,
    ...(markerWeightedScoreField != null ? { markerWeightedScore: markerWeightedScoreField } : {}),
    failingConstruct: null,
    failingScore: null,
    assessedMarkerCount: assessedMarkerIds.length,
    excludedMarkers,
    failReason: null,
    failReasonCodes: [],
    failReasonDetail: null,
  };
}
