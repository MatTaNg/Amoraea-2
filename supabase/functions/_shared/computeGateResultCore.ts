/** Canonical gate scoring — imported by app (`@features/aria/computeGateResultCore`) and edge functions. */
import {
  countDefensePatternsForDepthModifier,
  DEFENSE_PATTERN_COUNT_MODIFIERS,
  DEFENSE_PATTERN_REVIEW_MIN_COUNT,
  DISCLOSURE_UNDER_MODIFIER,
  EGO_DEVELOPMENT_LEVEL_MODIFIERS,
  EGO_DEVELOPMENT_REVIEW_LEVEL,
  EMOTION_RECOGNITION_FLOOR_EXCLUSIVE_MAX,
  EMOTION_RECOGNITION_MODIFIER_BELOW_FLOOR,
  EMOTION_RECOGNITION_MODIFIER_BELOW_REVIEW,
  EMOTION_RECOGNITION_MODIFIER_PERFECT,
  EMOTION_RECOGNITION_PERFECT_MIN_SCORE,
  EMOTION_RECOGNITION_REVIEW_EXCLUSIVE_MAX,
  MENTALIZING_OVERCERTAINTY_COUNT_MODIFIERS,
  MENTALIZING_OVERCERTAINTY_REVIEW_MIN_COUNT,
} from '../../../src/config/scoring/depthSignalModifiers.ts';
import {
  GATE_MARKER_BASE_WEIGHTS,
  GATE_MARKER_FLOORS,
  GATE_PASS_WEIGHTED_MIN,
  PASS_THRESHOLD,
  REFERRAL_WEIGHTED_PASS_MIN,
} from '../../../src/config/scoring/interviewGateThresholds.ts';
import {
  INTERVIEW_MARKER_IDS,
  INTERVIEW_MARKER_LABELS,
  type InterviewMarkerId,
} from './interviewMarkers.ts';
import {
  DEFAULT_DEFENSE_PATTERNS,
  type DefensePatternsJson,
} from './defensePatternsDetection.ts';
import { detectOverdisclosure } from './disclosureCalibration.ts';
import { normalizeResponseConcreteness, normalizeMoment4Concreteness, moment4Moment5ConcretenessDepthSignalDelta } from './personalMomentConcreteness.ts';
import {
  buildScenarioCompositesTriple,
  formatScenarioFloorFailReason,
  scenarioFloorBreaches,
  type ScenarioCompositesTriple,
  type ScenarioGateIndex as ScenarioCompositeGateIndex,
} from './scenarioCompositeFloor.ts';
import {
  formatMentalizingRepairFloorSnippet,
  mentalizingRepairFloorTriggered,
  type ScenarioPillarLow,
} from './mentalizingRepairScenarioFloor.ts';
import { resolveEmotionRecognitionRawScoreForGate } from './emotionRecognitionScoring.ts';
import { normalizeGateFailDetailForPersist } from './gateFailDetailForPersist.ts';
import { orderGateFailCodes } from './gateFailReasonsNormalize.ts';

function gateFailDetailForResult(
  detail: GateFailDetailJson | Record<string, unknown> | null | undefined,
): GateFailDetailJson {
  return normalizeGateFailDetailForPersist(detail) as GateFailDetailJson;
}

export {
  GATE_MARKER_BASE_WEIGHTS,
  GATE_MARKER_FLOORS,
  GATE_PASS_WEIGHTED_MIN,
  PASS_THRESHOLD,
  REFERRAL_WEIGHTED_PASS_MIN,
};

/** @deprecated Import from @config/scoring/interviewGateThresholds — re-exported for backward compatibility. */
export type GateMarkerBaseWeights = typeof GATE_MARKER_BASE_WEIGHTS;

export type GateResultReason =
  | 'pass'
  | 'floor_breach'
  | 'weighted_below_threshold'
  | 'ego_development_floor'
  | 'scenario_floor'
  | 'mentalizing_floor'
  | 'repair_floor'
  | 'no_assessed_markers'
  | 'incomplete_interview';

/** Stored on `interview_attempts.gate_fail_reasons`; multiple can apply at once. */
export type GateFailCode =
  | 'weighted_score'
  | 'immature_defense_pattern'
  | 'ego_development_floor'
  | 'scenario_floor'
  | 'mentalizing_floor'
  | 'repair_floor';

export type GateFailDetailJson = {
  weighted_score?: { score: number; requiredMin: number };
  immature_defense_pattern?: {
    flagCount: number;
    defensePatterns: DefensePatternsJson;
    scoreAfterDefenseModifiers: number;
  };
  ego_development_floor?: { level: number; weightedScore: number };
  scenario_floor?: {
    composites: ScenarioCompositesTriple;
    breaches: Array<{ scenario: ScenarioCompositeGateIndex; composite: number }>;
  };
  mentalizing_floor?: { lowScenarios: ScenarioPillarLow[] };
  repair_floor?: { lowScenarios: ScenarioPillarLow[] };
  psychometric_floors?: Record<string, { score: number; description: string }>;
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
  /**
   * Non-fatal review tags (routing to human / elevated AI review). Never imply automatic fail by themselves.
   * Always an array (possibly empty).
   */
  reviewFlags: string[];
  /** Sum of ego, defense, and personal-moment concreteness modifiers before threshold comparison. */
  scoreModifier?: number | null;
  /** Recalibrated depth-signal modifier (same value as {@link scoreModifier} for new scoring). */
  depthSignalModifier?: number | null;
  /** Marker + skip composite plus {@link scoreModifier}; compared to {@link GATE_PASS_WEIGHTED_MIN} / referral min. */
  modifiedWeightedScore?: number | null;
  /** Holistic ego-development adjustment applied before weighted threshold (see EGO_DEVELOPMENT_LEVEL_MODIFIERS). */
  egoDevelopmentModifier?: number | null;
  /** Cross-scenario defense pattern heuristics passed into the gate (from aggregate / transcript). */
  defensePatterns?: DefensePatternsJson | null;
  /** Sum of defense-related deductions applied to the weighted threshold score (negative or zero). */
  defensePatternScoreAdjustment?: number | null;
  /** Personal-moment concreteness gate adjustment (non-positive); echoed for persistence / audit. */
  personalMomentConcretenessModifier?: number | null;
  /** Normalized response_concreteness from Moment 4 scorer (absent | low | moderate | high). */
  moment4Concreteness?: string | null;
  moment5Concreteness?: string | null;
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
   * scenario’s slice) must be ≥ 5.0. Omit for holistic-only / scripts.
   */
  scenarioPillarScoresByScenario?: Partial<
    Record<1 | 2 | 3, Record<string, number | null | undefined> | null | undefined>
  >;
  /** Holistic-only: 1–5 from transcript meta-score; drives ego gate / modifier (omit when unknown). */
  egoDevelopmentLevel?: number | null;
  /** When supplied with aggregated slices, adjusts weighted threshold score and may set review / fail codes. */
  defensePatterns?: DefensePatternsJson | null;
  /** From aggregate: personal-moment concreteness strings (normalized) and combined threshold modifier. */
  moment4Concreteness?: string | null;
  moment5Concreteness?: string | null;
  personalMomentConcretenessModifier?: number | null;
  /**
   * Proportion correct (0–1) from in-interview emotion MC items. When `null`/`undefined`, emotion modifier/review omitted.
   * Prefer {@link emotionRecognitionResponses} with {@link resolveEmotionRecognitionRawScoreForGate} for incomplete batteries.
   */
  emotionRecognitionRawScore?: number | null;
  /**
   * Legacy: 0–3 correct count; converted to `correct/3` when {@link emotionRecognitionRawScore} is absent.
   */
  emotionRecognitionCorrectCount?: 0 | 1 | 2 | 3 | null;
  /** Stored `emotion_recognition_responses`; incomplete batteries (< 3 answers) exclude emotion from gate/modifier. */
  emotionRecognitionResponses?: unknown;
  disclosureCalibration?: string | null;
  /** Personal-moment user word counts for {@link detectOverdisclosure}. */
  moment4WordCount?: number | null;
  moment5WordCount?: number | null;
  /** When `'absent'` and ego ≤ 2, adds `closing_integration_absent` review flag. */
  closingIntegration?: string | null;
  /** Count of marker slices with mentalizing overcertainty; ≥ 2 adds `mentalizing_overcertainty` review flag. */
  mentalizingOvercertaintyCount?: number | null;
  /** Runtime review flags collected during the interview session. */
  runtimeReviewFlags?: string[] | null;
  /** M4 situational accountability exemption fired during rollup. */
  moment4AccountabilitySituationallyExempt?: boolean;
  moment4AccountabilityExemptReason?: string | null;
  /**
   * When set, used as the composite weighted score (marker average + skip penalties) for modifier math and for
   * {@link GateResult.weightedScore} — must match the value persisted to `interview_attempts.weighted_score`.
   * When omitted, the gate recomputes from {@link pillarScores} (must match callers that persist from the same map).
   */
  precomputedWeightedScore?: number | null;
};

const GATE_FAIL_CODE_ORDER: GateFailCode[] = [
  'weighted_score',
  'immature_defense_pattern',
  'ego_development_floor',
  'scenario_floor',
  'mentalizing_floor',
  'repair_floor',
];

function uniqueGateFailsOrdered(gateFailReasons: GateFailCode[]): GateFailCode[] {
  return orderGateFailCodes(gateFailReasons) as GateFailCode[];
}

function pickPrimaryGateReason(codes: GateFailCode[]): GateResultReason {
  for (const o of GATE_FAIL_CODE_ORDER) {
    if (codes.includes(o)) {
      if (o === 'weighted_score') return 'weighted_below_threshold';
      if (o === 'immature_defense_pattern') return 'weighted_below_threshold';
      if (o === 'ego_development_floor') return 'ego_development_floor';
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
    if (o === 'immature_defense_pattern' && detail.immature_defense_pattern) {
      return { failingConstruct: null, failingScore: detail.immature_defense_pattern.scoreAfterDefenseModifiers };
    }
    if (o === 'ego_development_floor' && detail.ego_development_floor) {
      return {
        failingConstruct: 'Ego development',
        failingScore: detail.ego_development_floor.level,
      };
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
    if (c === 'immature_defense_pattern' && detail.immature_defense_pattern) {
      const im = detail.immature_defense_pattern;
      parts.push(
        `immature_defense_pattern: ${im.flagCount} flags active; score_after_modifiers ${im.scoreAfterDefenseModifiers.toFixed(1)}`,
      );
    }
    if (c === 'ego_development_floor' && detail.ego_development_floor) {
      const e = detail.ego_development_floor;
      parts.push(`ego_development_floor: level ${e.level}, weighted ${e.weightedScore.toFixed(1)}`);
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

function resolveEmotionRecognitionRawScore(options: ComputeGateResultOptions | undefined): number | null {
  if (!options) return null;
  return resolveEmotionRecognitionRawScoreForGate({
    emotionRecognitionRawScore: options.emotionRecognitionRawScore,
    emotionRecognitionCorrectCount: options.emotionRecognitionCorrectCount,
    emotionRecognitionResponses: options.emotionRecognitionResponses,
  });
}

function parseNonNegativeGateInt(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.floor(v));
  if (typeof v === 'string' && String(v).trim() !== '') {
    const n = parseInt(String(v).trim(), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return 0;
}

/** Accept number or numeric string (e.g. JSON); must match aggregate / DB coercion. */
function parseEgoDevelopmentLevelForGate(raw: unknown): 1 | 2 | 3 | 4 | 5 | null {
  if (raw === null || raw === undefined) return null;
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && String(raw).trim() !== ''
        ? Number(String(raw).trim())
        : NaN;
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 1 || r > 5) return null;
  return r as 1 | 2 | 3 | 4 | 5;
}

/**
 * Marker renormalized weighted average + skip composite (same math as the gate’s internal composite, no modifiers).
 * Use to supply {@link ComputeGateResultOptions.precomputedWeightedScore} when the persisted `weighted_score` is
 * sourced outside the gate (e.g. must match aggregate merge) or to preview before calling {@link computeGateResultCore}.
 */
export function computeInterviewWeightedCompositeFromPillars(
  pillarScores: Record<string, number | null | undefined>,
  skepticismModifier?: { pillarId: number | string | null; adjustment: number; reason?: string } | null,
  skipPenaltyTotal = 0,
  skipAutoFail = false,
): number | null {
  const adjustedScores: Record<string, number | undefined> = { ...pillarScores } as Record<string, number | undefined>;
  if (skepticismModifier && skepticismModifier.pillarId != null && skepticismModifier.adjustment !== 0) {
    const id = String(skepticismModifier.pillarId);
    const current = adjustedScores[id];
    if (current !== undefined) {
      adjustedScores[id] = Math.min(9, Math.max(2, current + skepticismModifier.adjustment));
    }
  }
  const assessedMarkerIds = INTERVIEW_MARKER_IDS.filter((id) => isAssessedScore(adjustedScores[id]));
  if (assessedMarkerIds.length === 0) return null;
  const weightSumAssessed = assessedMarkerIds.reduce((sum, id) => sum + GATE_MARKER_BASE_WEIGHTS[id], 0);
  if (weightSumAssessed <= 0) return null;
  let weightedSum = 0;
  assessedMarkerIds.forEach((id) => {
    const baseW = GATE_MARKER_BASE_WEIGHTS[id];
    const effectiveW = baseW / weightSumAssessed;
    const raw = adjustedScores[id];
    const score = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
    weightedSum += score * effectiveW;
  });
  const markerWeightedScore = Math.round(weightedSum * 10) / 10;
  const skip = typeof skipPenaltyTotal === 'number' && Number.isFinite(skipPenaltyTotal) ? skipPenaltyTotal : 0;
  const fail = skipAutoFail === true;
  if (fail) return 0;
  return Math.round((markerWeightedScore + skip) * 10) / 10;
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
    reviewFlags: [],
    failReasonCodes: [],
    failReasonDetail: gateFailDetailForResult(null),
    modifiedWeightedScore: null,
    scoreModifier: 0,
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
  const precomputedOpt = options?.precomputedWeightedScore;
  const markerWeightedScoreField =
    skipAutoFail || skipPenaltyTotal !== 0 ? markerWeightedScore : undefined;
  const weightedMin = options?.weightedPassMin ?? GATE_PASS_WEIGHTED_MIN;

  const egoLv = parseEgoDevelopmentLevelForGate(options?.egoDevelopmentLevel);

  const dpMerged: DefensePatternsJson = {
    ...DEFAULT_DEFENSE_PATTERNS,
    ...(options?.defensePatterns ?? {}),
  };
  const dp = options?.defensePatterns ?? null;

  const m4cOpt = options?.moment4Concreteness;
  const m5cOpt = options?.moment5Concreteness;
  const m4n = normalizeMoment4Concreteness(m4cOpt);
  const m5n = normalizeResponseConcreteness(m5cOpt);

  const gateFailReasons: GateFailCode[] = [];
  const reviewFlags: string[] = [];

  // ─── DEPTH SIGNAL MODIFIER BLOCK ─────────────────────────────────────────────
  let depthSignalModifier = 0;

  const egoLevel = egoLv;
  if (egoLevel >= 1 && egoLevel <= 5) {
    depthSignalModifier += EGO_DEVELOPMENT_LEVEL_MODIFIERS[egoLevel as 1 | 2 | 3 | 4 | 5];
  }

  const _defenseCount = countDefensePatternsForDepthModifier(dpMerged);

  const defenseCountCapped = Math.min(4, _defenseCount) as 0 | 1 | 2 | 3 | 4;
  const defensePatternModifier = DEFENSE_PATTERN_COUNT_MODIFIERS[defenseCountCapped];
  depthSignalModifier += defensePatternModifier;

  depthSignalModifier += moment4Moment5ConcretenessDepthSignalDelta(m4n, m5n);

  const _overcertaintyCount = parseNonNegativeGateInt(options?.mentalizingOvercertaintyCount);
  if (_overcertaintyCount >= 1) {
    const overcertaintyCapped = Math.min(4, _overcertaintyCount) as 1 | 2 | 3 | 4;
    depthSignalModifier += MENTALIZING_OVERCERTAINTY_COUNT_MODIFIERS[overcertaintyCapped];
  }

  const _erScore = resolveEmotionRecognitionRawScore(options);
  if (_erScore !== null) {
    if (_erScore < EMOTION_RECOGNITION_FLOOR_EXCLUSIVE_MAX) {
      depthSignalModifier += EMOTION_RECOGNITION_MODIFIER_BELOW_FLOOR;
    } else if (_erScore < EMOTION_RECOGNITION_REVIEW_EXCLUSIVE_MAX) {
      depthSignalModifier += EMOTION_RECOGNITION_MODIFIER_BELOW_REVIEW;
    } else if (_erScore >= EMOTION_RECOGNITION_PERFECT_MIN_SCORE) {
      depthSignalModifier += EMOTION_RECOGNITION_MODIFIER_PERFECT;
    }
  }

  const _disclosure = options?.disclosureCalibration ?? null;
  if (_disclosure === 'underdisclosure') depthSignalModifier += DISCLOSURE_UNDER_MODIFIER;

  depthSignalModifier = Math.round(depthSignalModifier * 100) / 100;

  if (_defenseCount === DEFENSE_PATTERN_REVIEW_MIN_COUNT) reviewFlags.push('defense_pattern_review');

  if (_erScore !== null && _erScore < EMOTION_RECOGNITION_REVIEW_EXCLUSIVE_MAX) {
    reviewFlags.push('emotion_recognition_review');
  }

  if (_overcertaintyCount >= MENTALIZING_OVERCERTAINTY_REVIEW_MIN_COUNT) {
    reviewFlags.push('mentalizing_overcertainty');
  }

  if (egoLevel === EGO_DEVELOPMENT_REVIEW_LEVEL) reviewFlags.push('ego_development_review');

  const _baseScore =
    typeof precomputedOpt === 'number' && Number.isFinite(precomputedOpt) && !Number.isNaN(precomputedOpt)
      ? Math.round(precomputedOpt * 10) / 10
      : finalWeightedScore;
  const weightedScoreForPersistence = _baseScore;
  const depthSignalModifiedScore = Math.round((_baseScore + depthSignalModifier) * 100) / 100;

  if (skipAutoFail || depthSignalModifiedScore < weightedMin) {
    gateFailReasons.push('weighted_score');
  }

  if (
    (typeof Deno !== 'undefined' &&
      typeof Deno.env?.get === 'function' &&
      Deno.env.get('INTERVIEW_DEBUG_GATE') === '1') ||
    (typeof __DEV__ !== 'undefined' &&
      __DEV__ &&
      (typeof process === 'undefined' || process.env.JEST_WORKER_ID === undefined))
  ) {
    console.log(
      '[Gate] depthSignalModifier:',
      depthSignalModifier,
      'base:',
      _baseScore,
      'depthModified:',
      depthSignalModifiedScore,
    );
    console.log(
      '[Gate] inputs — egoLevel:',
      egoLevel,
      'defenseCount:',
      _defenseCount,
      'm4:',
      m4n,
      'm5:',
      m5n,
      'er:',
      _erScore,
      'overcertainty:',
      _overcertaintyCount,
      'disclosure:',
      _disclosure,
    );
  }
  // ─── END DEPTH SIGNAL MODIFIER BLOCK ─────────────────────────────────────────

  const scoreModifier = depthSignalModifier;
  const modifiedScore = depthSignalModifiedScore;
  const modifiedWeightedScore = depthSignalModifiedScore;
  const concretenessModifier = 0;

  const concOptsProvided =
    typeof options?.personalMomentConcretenessModifier === 'number' ||
    m4cOpt !== undefined ||
    m5cOpt !== undefined;

  const egoDevelopmentModifier: number | null =
    egoLv === null ? null : EGO_DEVELOPMENT_LEVEL_MODIFIERS[egoLv as 1 | 2 | 3 | 4 | 5];
  const defensePatternScoreAdjustment =
    _defenseCount > 0 ? defensePatternModifier : null;
  if (
    m4n !== null &&
    m5n !== null &&
    m4n !== 'valid_non_applicable' &&
    (m4n === 'absent' || m4n === 'low') &&
    (m5n === 'absent' || m5n === 'low') &&
    modifiedScore >= 6.0 &&
    modifiedScore < 7.0
  ) {
    reviewFlags.push('personal_moment_concreteness_review');
  }
  if (
    detectOverdisclosure({
      moment4WordCount: options?.moment4WordCount ?? null,
      moment5WordCount: options?.moment5WordCount ?? null,
      disclosureCalibration: options?.disclosureCalibration ?? null,
      moment4Concreteness: m4n,
      moment5Concreteness: m5n,
    })
  ) {
    reviewFlags.push('overdisclosure_review');
    console.log('[Disclosure] overdisclosure_review flag added');
  }
  if (options?.moment4AccountabilitySituationallyExempt === true) {
    const reason =
      options.moment4AccountabilityExemptReason?.trim() ||
      'situationally appropriate harm or abandonment disclosure';
    reviewFlags.push(
      `M4 accountability absence flagged as situationally appropriate — ${reason}. Accountability pillar weighted toward M5. Manual review recommended if accountability is borderline.`,
    );
  }
  for (const flag of options?.runtimeReviewFlags ?? []) {
    const trimmed = typeof flag === 'string' ? flag.trim() : '';
    if (trimmed) reviewFlags.push(trimmed);
  }
  if (options?.closingIntegration === 'absent' && egoLv !== null && egoLv <= 2) {
    reviewFlags.push('closing_integration_absent');
  }

  const gateExtras = (): Pick<
    GateResult,
    | 'reviewFlags'
    | 'scoreModifier'
    | 'modifiedWeightedScore'
    | 'egoDevelopmentModifier'
    | 'defensePatterns'
    | 'defensePatternScoreAdjustment'
    | 'personalMomentConcretenessModifier'
    | 'moment4Concreteness'
    | 'moment5Concreteness'
  > => ({
    reviewFlags,
    scoreModifier,
    depthSignalModifier,
    modifiedWeightedScore,
    ...(egoDevelopmentModifier != null ? { egoDevelopmentModifier } : {}),
    ...(dp ? { defensePatterns: dp } : {}),
    ...(defensePatternScoreAdjustment != null ? { defensePatternScoreAdjustment } : {}),
    ...(concOptsProvided
      ? {
          personalMomentConcretenessModifier: concretenessModifier,
          moment4Concreteness: m4cOpt ?? null,
          moment5Concreteness: m5cOpt ?? null,
        }
      : {}),
  });

  let simpleSum = 0;
  assessedMarkerIds.forEach((id) => {
    simpleSum += (adjustedScores[id] as number) ?? 0;
  });
  const simpleAverage = simpleSum / assessedMarkerIds.length;
  const weightedVsSimpleDelta = Math.round((markerWeightedScore - simpleAverage) * 1000) / 1000;

  const breakdownConcreteness =
    concOptsProvided
      ? {
          personal_moment_concreteness_modifier: concretenessModifier,
          moment_4_concreteness: m4cOpt ?? null,
          moment_5_concreteness: m5cOpt ?? null,
        }
      : {};
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[WEIGHTED_SCORE_BREAKDOWN]', {
      contributions,
      weightSumAssessed,
      simpleAverage: Math.round(simpleAverage * 1000) / 1000,
      weightedScore: markerWeightedScore,
      composite_weighted_score: weightedScoreForPersistence,
      weightedVsSimpleDelta,
      score_modifier: scoreModifier,
      modified_weighted_score: modifiedWeightedScore,
      ...breakdownConcreteness,
    });
  }
  options?.onWeightedBreakdown?.({
    contributions,
    weightSumAssessed,
    assessedMarkerCount: assessedMarkerIds.length,
    excludedMarkers,
    simpleAverage: Math.round(simpleAverage * 1000) / 1000,
    weightedScore: markerWeightedScore,
    composite_weighted_score: weightedScoreForPersistence,
    weightedVsSimpleDelta,
    score_modifier: scoreModifier,
    modified_weighted_score: modifiedWeightedScore,
    ...breakdownConcreteness,
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
    const earlyScenarioCodes: GateFailCode[] = [];
    if (scenarioFloorGateDetail) earlyScenarioCodes.push('scenario_floor');
    if (scenarioMaps != null) {
      const mrEarly = mentalizingRepairFloorTriggered(scenarioMaps);
      if (mrEarly.mentalizingFloorFails) earlyScenarioCodes.push('mentalizing_floor');
      if (mrEarly.repairFloorFails) earlyScenarioCodes.push('repair_floor');
    }
    let earlyFailCodes = uniqueGateFailsOrdered([...gateFailReasons, ...earlyScenarioCodes]);
    if (earlyFailCodes.length === 0) {
      earlyFailCodes = ['weighted_score'];
    }
    const earlyDetail: GateFailDetailJson = { ...(scenarioFloorGateDetail ?? {}) };
    if (earlyFailCodes.includes('weighted_score')) {
      earlyDetail.weighted_score = { score: modifiedScore, requiredMin: GATE_PASS_WEIGHTED_MIN };
    }
    if (scenarioMaps != null) {
      const mrEarly = mentalizingRepairFloorTriggered(scenarioMaps);
      if (earlyFailCodes.includes('mentalizing_floor') && mrEarly.mentalizingFloorFails) {
        earlyDetail.mentalizing_floor = { lowScenarios: mrEarly.mentalizingLowScenarios };
      }
      if (earlyFailCodes.includes('repair_floor') && mrEarly.repairFloorFails) {
        earlyDetail.repair_floor = { lowScenarios: mrEarly.repairLowScenarios };
      }
    }
    return {
      pass: false,
      reason: 'floor_breach',
      weightedScore: weightedScoreForPersistence,
      ...(markerWeightedScoreField != null ? { markerWeightedScore: markerWeightedScoreField } : {}),
      failingConstruct: INTERVIEW_MARKER_LABELS[first.id] ?? first.id,
      failingScore: first.score,
      assessedMarkerCount: assessedMarkerIds.length,
      excludedMarkers,
      failReason: formatFloorBreachFailReason(floorBreaches),
      scenarioComposites,
      failReasonCodes: earlyFailCodes,
      failReasonDetail: gateFailDetailForResult(earlyDetail),
      ...gateExtras(),
    };
  }

  if (scenarioFloorGateDetail) {
    gateFailReasons.push('scenario_floor');
  }

  if (scenarioMaps != null) {
    const mr = mentalizingRepairFloorTriggered(scenarioMaps);
    if (mr.mentalizingFloorFails) {
      gateFailReasons.push('mentalizing_floor');
    }
    if (mr.repairFloorFails) {
      gateFailReasons.push('repair_floor');
    }
  }

  const failCodesOrdered = uniqueGateFailsOrdered(gateFailReasons);

  const detail: GateFailDetailJson = {};
  if (failCodesOrdered.includes('weighted_score')) {
    detail.weighted_score = { score: modifiedScore, requiredMin: GATE_PASS_WEIGHTED_MIN };
  }
  if (failCodesOrdered.includes('immature_defense_pattern')) {
    detail.immature_defense_pattern = {
      flagCount: _defenseCount,
      defensePatterns: dpMerged,
      scoreAfterDefenseModifiers: modifiedScore,
    };
  }
  if (failCodesOrdered.includes('ego_development_floor') && egoLv === 1) {
    detail.ego_development_floor = { level: 1, weightedScore: modifiedScore };
  }
  if (scenarioFloorGateDetail && failCodesOrdered.includes('scenario_floor')) {
    Object.assign(detail, scenarioFloorGateDetail);
  }
  if (scenarioMaps != null) {
    const mr = mentalizingRepairFloorTriggered(scenarioMaps);
    if (failCodesOrdered.includes('mentalizing_floor') && mr.mentalizingFloorFails) {
      detail.mentalizing_floor = { lowScenarios: mr.mentalizingLowScenarios };
    }
    if (failCodesOrdered.includes('repair_floor') && mr.repairFloorFails) {
      detail.repair_floor = { lowScenarios: mr.repairLowScenarios };
    }
  }

  const passedAggregate = failCodesOrdered.length === 0 && modifiedScore >= weightedMin;

  if (!passedAggregate) {
    const resolvedFailCodes: GateFailCode[] =
      failCodesOrdered.length > 0 ? failCodesOrdered : ['weighted_score'];
    if (resolvedFailCodes.includes('weighted_score') && !detail.weighted_score) {
      detail.weighted_score = { score: modifiedScore, requiredMin: GATE_PASS_WEIGHTED_MIN };
    }
    const primary = pickPrimaryGateReason(resolvedFailCodes);
    const { failingConstruct, failingScore } = pickPrimaryFailingConstructAndScore(resolvedFailCodes, detail);
    return {
      pass: false,
      reason: primary,
      weightedScore: weightedScoreForPersistence,
      ...(markerWeightedScoreField != null ? { markerWeightedScore: markerWeightedScoreField } : {}),
      failingConstruct,
      failingScore,
      assessedMarkerCount: assessedMarkerIds.length,
      excludedMarkers,
      failReason: formatAggregateGateFailReason(resolvedFailCodes, detail, modifiedScore, weightedMin),
      failReasonCodes: resolvedFailCodes,
      failReasonDetail: gateFailDetailForResult(detail),
      scenarioComposites,
      ...gateExtras(),
    };
  }

  if (scenarioMaps != null) {
    return {
      pass: true,
      reason: 'pass',
      weightedScore: weightedScoreForPersistence,
      ...(markerWeightedScoreField != null ? { markerWeightedScore: markerWeightedScoreField } : {}),
      failingConstruct: null,
      failingScore: null,
      assessedMarkerCount: assessedMarkerIds.length,
      excludedMarkers,
      failReason: null,
      failReasonCodes: [],
      failReasonDetail: gateFailDetailForResult(null),
      scenarioComposites,
      ...gateExtras(),
    };
  }

  return {
    pass: true,
    reason: 'pass',
    weightedScore: weightedScoreForPersistence,
    ...(markerWeightedScoreField != null ? { markerWeightedScore: markerWeightedScoreField } : {}),
    failingConstruct: null,
    failingScore: null,
    assessedMarkerCount: assessedMarkerIds.length,
    excludedMarkers,
    failReason: null,
    failReasonCodes: [],
    failReasonDetail: gateFailDetailForResult(null),
    ...gateExtras(),
  };
}
