import {
  formatSd3NarcissismFloorAdminDescription,
  isRetroactiveSd3NarcissismFloorReview,
  SD3_NARCISSISM_FLOOR_FAIL_CODE,
  SD3_NARCISSISM_FLOOR_THRESHOLD,
  SD3_NARCISSISM_STRAIGHT_LINE_FLAG,
  wouldTriggerSd3NarcissismFloor,
} from './sd3NarcissismFloor';
import { coercePsychometricScore } from './usersPsychometricsSchemaFallback';

export const RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_THRESHOLD = 2.0;
export const RFQ_STRAIGHT_LINE_FLAG = 'rfq_straight_line';
export const RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE = 'rfq_low_reflective_functioning_floor';
export const RFQ_ITEM_COUNT = 8;

export const GASP_EXTREME_EXTERNALIZATION_FLOOR_THRESHOLD = 5.5;
export const GASP_STRAIGHT_LINE_FLAG = 'gasp_straight_line';
export const GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE = 'gasp_extreme_externalization_floor';

export const DWECK_EXTREME_FIXED_MINDSET_FLOOR_THRESHOLD = 2.0;
export const DWECK_STRAIGHT_LINE_FLAG = 'dweck_straight_line';
export const DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE = 'dweck_extreme_fixed_mindset_floor';
export const DWECK_ITEM_COUNT = 10;

export const SCS_SF_LOW_SELF_COMPASSION_FLOOR_THRESHOLD = 1.5;
export const SCS_SF_STRAIGHT_LINE_FLAG = 'scs_sf_straight_line';
export const SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE = 'scs_sf_low_self_compassion_floor';

export type PsychometricFloorUserScores = {
  rfqScore: number | null;
  gaspScore: number | null;
  dweckScore: number | null;
  scsSfScore: number | null;
  sd3NarcissismScore: number | null;
};

export type PsychometricFloorReview = {
  id: string;
  score: number;
  description: string;
  retroactiveNote: string;
};

function hasStraightLineFlag(
  straightLineFlags: string[] | null | undefined,
  flag: string,
): boolean {
  return (straightLineFlags ?? []).includes(flag);
}

export function detectRfqStraightLineFromResponses(
  responses: Record<number, number> | undefined,
): boolean {
  if (!responses) return false;
  const values = Object.values(responses);
  return values.length === RFQ_ITEM_COUNT && new Set(values).size === 1;
}

export function wouldTriggerRfqLowReflectiveFunctioningFloor(
  rfqScore: number | null,
  straightLineFlags: string[] | null | undefined,
): boolean {
  if (rfqScore === null || !Number.isFinite(rfqScore)) return false;
  if (rfqScore >= RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_THRESHOLD) return false;
  if (hasStraightLineFlag(straightLineFlags, RFQ_STRAIGHT_LINE_FLAG)) return false;
  return true;
}

export function wouldTriggerGaspExtremeExternalizationFloor(
  gaspScore: number | null,
  straightLineFlags: string[] | null | undefined,
): boolean {
  if (gaspScore === null || !Number.isFinite(gaspScore)) return false;
  if (gaspScore < GASP_EXTREME_EXTERNALIZATION_FLOOR_THRESHOLD) return false;
  if (hasStraightLineFlag(straightLineFlags, GASP_STRAIGHT_LINE_FLAG)) return false;
  return true;
}

export function wouldTriggerDweckExtremeFixedMindsetFloor(
  dweckScore: number | null,
  straightLineFlags: string[] | null | undefined,
): boolean {
  if (dweckScore === null || !Number.isFinite(dweckScore)) return false;
  if (dweckScore >= DWECK_EXTREME_FIXED_MINDSET_FLOOR_THRESHOLD) return false;
  if (hasStraightLineFlag(straightLineFlags, DWECK_STRAIGHT_LINE_FLAG)) return false;
  return true;
}

export function wouldTriggerScsSfLowSelfCompassionFloor(
  scsSfScore: number | null,
  straightLineFlags: string[] | null | undefined,
): boolean {
  if (scsSfScore === null || !Number.isFinite(scsSfScore)) return false;
  if (scsSfScore >= SCS_SF_LOW_SELF_COMPASSION_FLOOR_THRESHOLD) return false;
  if (hasStraightLineFlag(straightLineFlags, SCS_SF_STRAIGHT_LINE_FLAG)) return false;
  return true;
}

export function formatRfqLowReflectiveFunctioningFloorAdminDescription(rfqScore: number): string {
  return `RFQ score of ${rfqScore.toFixed(2)} is below the automatic fail threshold of ${RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_THRESHOLD.toFixed(1)}. User self-reported a fundamental inability to understand their own or others' mental states — cannot link past experiences to current feelings, cannot understand why people behave as they do, and acts without thinking about motivations. This level of psychological opacity is incompatible with the emotional intimacy required for committed partnership. Note: this floor does not fire on straight-line response patterns.`;
}

export function formatGaspExtremeExternalizationFloorAdminDescription(gaspScore: number): string {
  return `GASP externalization score of ${gaspScore.toFixed(2)} meets or exceeds the automatic fail threshold of ${GASP_EXTREME_EXTERNALIZATION_FLOOR_THRESHOLD.toFixed(1)}. User self-reported near-complete absence of personal accountability — consistently endorsing blame attribution to others after their own wrongdoing at a level incompatible with healthy relational functioning. The existing modifier penalty is insufficient to capture the severity of this pattern. Note: this floor does not fire on straight-line response patterns.`;
}

export function formatDweckExtremeFixedMindsetFloorAdminDescription(dweckScore: number): string {
  return `Relationship Beliefs score of ${dweckScore.toFixed(2)} is below the automatic fail threshold of ${DWECK_EXTREME_FIXED_MINDSET_FLOOR_THRESHOLD.toFixed(1)}. User self-reported a fundamental belief that people and relationship patterns cannot change, and that disagreement signals incompatibility. This belief system is incompatible with the growth orientation required for sustainable partnership and strongly suggests limited personal development work. Someone who sees people as static has likely not experienced meaningful change in themselves. Note: this floor does not fire on straight-line response patterns.`;
}

export function formatScsSfLowSelfCompassionFloorAdminDescription(scsSfScore: number): string {
  return `SCS-SF self-compassion score of ${scsSfScore.toFixed(2)} is below the automatic fail threshold of ${SCS_SF_LOW_SELF_COMPASSION_FLOOR_THRESHOLD.toFixed(1)}. User self-reported being almost always self-judgmental, intolerant of their own imperfections, and unable to treat themselves with kindness under difficulty. Very low self-compassion indicates limited shadow work completion and an active inner critic that would significantly impact intimate partnership — both through self-critical spirals during relational difficulty and through projection of harsh self-judgment onto a partner. Note: this floor does not fire on straight-line response patterns.`;
}

export function retroactivePsychometricFloorReviewNote(floorId: string): string {
  return `This attempt would have triggered ${floorId} under the current scoring rules. Manual review recommended.`;
}

function isRetroactiveFloorReview(
  attempt: { gate_fail_reasons?: unknown } | null | undefined,
  floorId: string,
  wouldTrigger: boolean,
): boolean {
  if (!attempt || !wouldTrigger) return false;
  const raw = attempt.gate_fail_reasons;
  if (!Array.isArray(raw)) return true;
  const codes = raw.filter((x): x is string => typeof x === 'string');
  return !codes.includes(floorId);
}

/** Legacy psychometric auto-fail codes (AAQ-II / RSES) — same gate_fail_reasons pipeline as instrument floors. */
export const LOW_SELF_ESTEEM_FLOOR_CODE = 'low_self_esteem_floor';
export const HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE = 'high_experiential_avoidance_floor';

export const ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES = [
  RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
  GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE,
  DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE,
  SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE,
  SD3_NARCISSISM_FLOOR_FAIL_CODE,
  LOW_SELF_ESTEEM_FLOOR_CODE,
  HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE,
] as const;

export type PsychometricGateFailFloorCode = (typeof ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES)[number];

export function isPsychometricGateFailFloorCode(id: string): id is PsychometricGateFailFloorCode {
  return (ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES as readonly string[]).includes(id);
}

export function collectLegacyPsychometricFloorGateFailReasons(
  aaq2Score: number | null,
  rsesScore: number | null,
): string[] {
  const breaches: string[] = [];
  if (aaq2Score != null && Number.isFinite(aaq2Score) && aaq2Score >= 42) {
    breaches.push(HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE);
  }
  if (rsesScore != null && Number.isFinite(rsesScore) && rsesScore <= 12) {
    breaches.push(LOW_SELF_ESTEEM_FLOOR_CODE);
  }
  return breaches;
}

/** Single source of truth for gate_fail_reasons and uncertainty activeFlags (instrument + legacy floors). */
export function collectPsychometricFloorGateFailReasons(
  scores: PsychometricFloorUserScores,
  straightLineFlags: string[] | null | undefined,
  legacy?: { aaq2Score: number | null; rsesScore: number | null },
): string[] {
  return [
    ...collectPsychometricFloorUncertaintyFlags(scores, straightLineFlags),
    ...collectLegacyPsychometricFloorGateFailReasons(
      legacy?.aaq2Score ?? null,
      legacy?.rsesScore ?? null,
    ),
  ];
}

/** Telemetry for floor gating — scores evaluated at mergePsychometricFloorsIntoGateState time. */
export function logPsychometricFloorEvaluation(
  context: { attemptId?: string; userId?: string },
  scores: PsychometricFloorUserScores,
  straightLineFlags: string[] | null | undefined,
): void {
  const rfqWould = wouldTriggerRfqLowReflectiveFunctioningFloor(scores.rfqScore, straightLineFlags);
  const sd3Would = wouldTriggerSd3NarcissismFloor(scores.sd3NarcissismScore, straightLineFlags);
  if (__DEV__ || rfqWould || sd3Would) {
    console.log('[PsychometricFloor]', {
      ...context,
      psychometrics_rfq_score: scores.rfqScore,
      rfq_low_reflective_functioning_floor: rfqWould,
      rfq_straight_line_suppressed: (straightLineFlags ?? []).includes(RFQ_STRAIGHT_LINE_FLAG),
      sd3_narcissism_score_effective: scores.sd3NarcissismScore,
      sd3_narcissism_floor: sd3Would,
      sd3_narcissism_straight_line_suppressed: (straightLineFlags ?? []).includes(
        SD3_NARCISSISM_STRAIGHT_LINE_FLAG,
      ),
    });
  }
}

/** Alias — uncertainty activeFlags use the same floor detection as gate_fail_reasons. */
export function collectPsychometricFloorUncertaintyFlags(
  scores: PsychometricFloorUserScores,
  straightLineFlags: string[] | null | undefined,
): string[] {
  const flags: string[] = [];
  if (wouldTriggerRfqLowReflectiveFunctioningFloor(scores.rfqScore, straightLineFlags)) {
    flags.push(RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE);
  }
  if (wouldTriggerGaspExtremeExternalizationFloor(scores.gaspScore, straightLineFlags)) {
    flags.push(GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE);
  }
  if (wouldTriggerDweckExtremeFixedMindsetFloor(scores.dweckScore, straightLineFlags)) {
    flags.push(DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE);
  }
  if (wouldTriggerScsSfLowSelfCompassionFloor(scores.scsSfScore, straightLineFlags)) {
    flags.push(SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE);
  }
  if (
    scores.sd3NarcissismScore != null &&
    Number.isFinite(scores.sd3NarcissismScore) &&
    scores.sd3NarcissismScore >= SD3_NARCISSISM_FLOOR_THRESHOLD
  ) {
    const sd3WouldTrigger = wouldTriggerSd3NarcissismFloor(
      scores.sd3NarcissismScore,
      straightLineFlags,
    );
    console.log('[PsychometricFloor] SD3 narcissism floor pre-check (collectPsychometricFloorUncertaintyFlags)', {
      sd3NarcissismScore: scores.sd3NarcissismScore,
      wouldTriggerSd3NarcissismFloor: sd3WouldTrigger,
      straightLineFlags: straightLineFlags ?? [],
    });
  }
  if (wouldTriggerSd3NarcissismFloor(scores.sd3NarcissismScore, straightLineFlags)) {
    flags.push(SD3_NARCISSISM_FLOOR_FAIL_CODE);
  }
  return flags;
}

export function formatPsychometricGateFailDescription(floorId: string, score: number): string {
  switch (floorId) {
    case RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE:
      return formatRfqLowReflectiveFunctioningFloorAdminDescription(score);
    case GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE:
      return formatGaspExtremeExternalizationFloorAdminDescription(score);
    case DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE:
      return formatDweckExtremeFixedMindsetFloorAdminDescription(score);
    case SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE:
      return formatScsSfLowSelfCompassionFloorAdminDescription(score);
    case SD3_NARCISSISM_FLOOR_FAIL_CODE:
      return formatSd3NarcissismFloorAdminDescription(score);
    case LOW_SELF_ESTEEM_FLOOR_CODE:
      return `Rosenberg Self-Esteem score of ${score.toFixed(0)} is at or below the automatic fail threshold of 12. Very low self-esteem is incompatible with the emotional stability required for committed partnership.`;
    case HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE:
      return `AAQ-II experiential avoidance score of ${score.toFixed(0)} is at or above the automatic fail threshold of 42. Severe experiential avoidance indicates fundamental difficulty tolerating difficult emotions in relationship.`;
    default:
      return floorId;
  }
}

export function getPsychometricFloorAdminDescription(
  floorId: string,
  score: number,
): string | null {
  if (!isPsychometricGateFailFloorCode(floorId)) {
    return null;
  }
  return formatPsychometricGateFailDescription(floorId, score);
}

export type PsychometricFloorDetailEntry = {
  score: number;
  description: string;
};

export function psychometricFloorScoreForGateDetail(
  floorId: string,
  scores: PsychometricFloorUserScores & { aaq2Score?: number | null; rsesScore?: number | null },
): number | null {
  switch (floorId) {
    case RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE:
      return coercePsychometricScore(scores.rfqScore);
    case GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE:
      return coercePsychometricScore(scores.gaspScore);
    case DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE:
      return coercePsychometricScore(scores.dweckScore);
    case SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE:
      return coercePsychometricScore(scores.scsSfScore);
    case SD3_NARCISSISM_FLOOR_FAIL_CODE:
      return coercePsychometricScore(scores.sd3NarcissismScore);
    case LOW_SELF_ESTEEM_FLOOR_CODE:
      return coercePsychometricScore(scores.rsesScore);
    case HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE:
      return coercePsychometricScore(scores.aaq2Score);
    default:
      return null;
  }
}

export function buildPsychometricGateFailDetail(
  floorIds: string[],
  scores: PsychometricFloorUserScores & { aaq2Score?: number | null; rsesScore?: number | null },
): Record<string, PsychometricFloorDetailEntry> {
  const detail: Record<string, PsychometricFloorDetailEntry> = {};
  for (const floorId of floorIds) {
    if (!isPsychometricGateFailFloorCode(floorId)) continue;
    const score = psychometricFloorScoreForGateDetail(floorId, scores);
    if (score == null || !Number.isFinite(score)) continue;
    detail[floorId] = {
      score,
      description: formatPsychometricGateFailDescription(floorId, score),
    };
  }
  return detail;
}

/**
 * Normalize `psychometric_floors` to keyed `{ score, description }` entries.
 * Legacy string[] shape (written at interview completion) has no detail — discard it.
 */
export function normalizePsychometricFloorsGateDetail(
  existing: unknown,
  scores: PsychometricFloorUserScores & { aaq2Score?: number | null; rsesScore?: number | null },
): Record<string, PsychometricFloorDetailEntry> {
  if (existing == null) return {};
  if (Array.isArray(existing)) {
    const floorIds = existing.filter(
      (id): id is PsychometricGateFailFloorCode =>
        typeof id === 'string' && isPsychometricGateFailFloorCode(id),
    );
    return buildPsychometricGateFailDetail(floorIds, scores);
  }
  if (typeof existing !== 'object') return {};
  const out: Record<string, PsychometricFloorDetailEntry> = {};
  for (const [key, val] of Object.entries(existing as Record<string, unknown>)) {
    if (!isPsychometricGateFailFloorCode(key)) continue;
    if (val == null || typeof val !== 'object' || Array.isArray(val)) continue;
    const scoreRaw = (val as { score?: unknown }).score;
    const descriptionRaw = (val as { description?: unknown }).description;
    const score = coercePsychometricScore(scoreRaw);
    if (score == null || typeof descriptionRaw !== 'string' || !descriptionRaw.trim()) continue;
    out[key] = { score, description: descriptionRaw };
  }
  return out;
}

export function extractPsychometricFloorsFromGateDetail(
  detail: Record<string, unknown> | null | undefined,
): Record<string, PsychometricFloorDetailEntry> {
  if (detail == null || typeof detail !== 'object' || Array.isArray(detail)) return {};
  return normalizePsychometricFloorsGateDetail(detail.psychometric_floors, {});
}

function mergePsychometricFloorsDetailEntries(
  floorBreaches: string[],
  scores: PsychometricFloorUserScores & { aaq2Score?: number | null; rsesScore?: number | null },
  priorPsychFloors: Record<string, PsychometricFloorDetailEntry>,
): Record<string, PsychometricFloorDetailEntry> {
  const priorSafe =
    priorPsychFloors != null && !Array.isArray(priorPsychFloors) && typeof priorPsychFloors === 'object'
      ? priorPsychFloors
      : {};
  const merged: Record<string, PsychometricFloorDetailEntry> = {
    ...priorSafe,
    ...buildPsychometricGateFailDetail(floorBreaches, scores),
  };
  for (const floorId of floorBreaches) {
    if (merged[floorId]) continue;
    const score = psychometricFloorScoreForGateDetail(floorId, scores);
    if (score == null || !Number.isFinite(score)) continue;
    merged[floorId] = {
      score,
      description: formatPsychometricGateFailDescription(floorId, score),
    };
  }
  const allowed = new Set(floorBreaches);
  for (const key of Object.keys(merged)) {
    if (!allowed.has(key)) delete merged[key];
  }
  return merged;
}

function finalizePsychometricFloorsGateDetail(
  detail: Record<string, PsychometricFloorDetailEntry>,
  floorBreaches: string[],
  scores: PsychometricFloorUserScores & { aaq2Score?: number | null; rsesScore?: number | null },
): Record<string, PsychometricFloorDetailEntry> {
  if (Array.isArray(detail)) {
    return buildPsychometricGateFailDetail(floorBreaches, scores);
  }
  return detail;
}

export function extractPsychometricFloorCodesFromGateFailReasons(
  reasons: string[] | null | undefined,
): string[] {
  return (reasons ?? []).filter((id): id is PsychometricGateFailFloorCode => isPsychometricGateFailFloorCode(id));
}

/** When interview gate is persisted, keep psychometric floors that were already merged by applyPsychometricModifier. */
export function mergeInterviewGateFailReasonsPreservingPsychometricFloors(
  incomingGateFailReasons: string[],
  priorGateFailReasons: string[] | null | undefined,
): string[] {
  const preserved = extractPsychometricFloorCodesFromGateFailReasons(priorGateFailReasons);
  return [...new Set([...incomingGateFailReasons, ...preserved])];
}

export function mergePsychometricFloorsIntoGateState(opts: {
  existingFailReasons: string[];
  existingDetail: Record<string, unknown> | null | undefined;
  scores: PsychometricFloorUserScores;
  straightLineFlags: string[] | null | undefined;
  aaq2Score: number | null;
  rsesScore: number | null;
  attemptId?: string;
  userId?: string;
}): { gateFailReasons: string[]; gateFailDetail: Record<string, unknown> } {
  logPsychometricFloorEvaluation(
    { attemptId: opts.attemptId, userId: opts.userId },
    opts.scores,
    opts.straightLineFlags,
  );
  const floorBreaches = collectPsychometricFloorGateFailReasons(opts.scores, opts.straightLineFlags, {
    aaq2Score: opts.aaq2Score,
    rsesScore: opts.rsesScore,
  });
  const gateFailReasons = [...new Set([...opts.existingFailReasons, ...floorBreaches])];
  const scoresForDetail = {
    ...opts.scores,
    aaq2Score: opts.aaq2Score,
    rsesScore: opts.rsesScore,
  };
  const priorDetail =
    opts.existingDetail != null && typeof opts.existingDetail === 'object' && !Array.isArray(opts.existingDetail)
      ? opts.existingDetail
      : {};
  const rawPriorPsychFloors = priorDetail.psychometric_floors;
  const priorPsychFloors = normalizePsychometricFloorsGateDetail(rawPriorPsychFloors, scoresForDetail);
  const psychometric_floors = finalizePsychometricFloorsGateDetail(
    mergePsychometricFloorsDetailEntries(floorBreaches, scoresForDetail, priorPsychFloors),
    floorBreaches,
    scoresForDetail,
  );
  const { psychometric_floors: _legacyPsychFloors, ...priorDetailWithoutPsychFloors } = priorDetail;
  const gateFailDetail: Record<string, unknown> = {
    ...priorDetailWithoutPsychFloors,
    psychometric_floors,
  };
  return { gateFailReasons, gateFailDetail };
}

export const PSYCHOMETRIC_GATE_FAIL_FLOOR_IDS = [
  RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
  GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE,
  DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE,
  SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE,
  SD3_NARCISSISM_FLOOR_FAIL_CODE,
] as const;

export type PsychometricGateFailFloorId = (typeof PSYCHOMETRIC_GATE_FAIL_FLOOR_IDS)[number];

export function psychometricFloorScoreForUser(
  floorId: string,
  user: PsychometricFloorUserScores & { aaq2Score?: number | null; rsesScore?: number | null },
): number | null {
  return psychometricFloorScoreForGateDetail(floorId, user);
}

export function getRetroactivePsychometricFloorReviews(
  attempt: { gate_fail_reasons?: unknown } | null | undefined,
  scores: PsychometricFloorUserScores,
  straightLineFlags: string[] | null | undefined,
): PsychometricFloorReview[] {
  const reviews: PsychometricFloorReview[] = [];
  const candidates: Array<{
    id: string;
    score: number | null;
    wouldTrigger: boolean;
    description: (score: number) => string;
  }> = [
    {
      id: RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
      score: scores.rfqScore,
      wouldTrigger: wouldTriggerRfqLowReflectiveFunctioningFloor(scores.rfqScore, straightLineFlags),
      description: formatRfqLowReflectiveFunctioningFloorAdminDescription,
    },
    {
      id: GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE,
      score: scores.gaspScore,
      wouldTrigger: wouldTriggerGaspExtremeExternalizationFloor(scores.gaspScore, straightLineFlags),
      description: formatGaspExtremeExternalizationFloorAdminDescription,
    },
    {
      id: DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE,
      score: scores.dweckScore,
      wouldTrigger: wouldTriggerDweckExtremeFixedMindsetFloor(scores.dweckScore, straightLineFlags),
      description: formatDweckExtremeFixedMindsetFloorAdminDescription,
    },
    {
      id: SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE,
      score: scores.scsSfScore,
      wouldTrigger: wouldTriggerScsSfLowSelfCompassionFloor(scores.scsSfScore, straightLineFlags),
      description: formatScsSfLowSelfCompassionFloorAdminDescription,
    },
  ];

  for (const candidate of candidates) {
    if (
      candidate.score == null ||
      !Number.isFinite(candidate.score) ||
      !isRetroactiveFloorReview(attempt, candidate.id, candidate.wouldTrigger)
    ) {
      continue;
    }
    reviews.push({
      id: candidate.id,
      score: candidate.score,
      description: candidate.description(candidate.score),
      retroactiveNote: retroactivePsychometricFloorReviewNote(candidate.id),
    });
  }

  if (
    scores.sd3NarcissismScore != null &&
    Number.isFinite(scores.sd3NarcissismScore) &&
    isRetroactiveSd3NarcissismFloorReview(attempt, scores.sd3NarcissismScore, straightLineFlags)
  ) {
    reviews.push({
      id: SD3_NARCISSISM_FLOOR_FAIL_CODE,
      score: scores.sd3NarcissismScore,
      description: formatSd3NarcissismFloorAdminDescription(scores.sd3NarcissismScore),
      retroactiveNote: retroactivePsychometricFloorReviewNote(SD3_NARCISSISM_FLOOR_FAIL_CODE),
    });
  }

  return reviews;
}

export function userNeedsPsychometricFloorReview(
  attempt: { gate_fail_reasons?: unknown } | null | undefined,
  scores: PsychometricFloorUserScores,
  straightLineFlags: string[] | null | undefined,
): boolean {
  return getRetroactivePsychometricFloorReviews(attempt, scores, straightLineFlags).length > 0;
}
