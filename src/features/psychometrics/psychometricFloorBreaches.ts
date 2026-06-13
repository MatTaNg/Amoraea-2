import {
  formatSd3NarcissismFloorAdminDescription,
  isRetroactiveSd3NarcissismFloorReview,
  SD3_NARCISSISM_FLOOR_FAIL_CODE,
  SD3_NARCISSISM_FLOOR_THRESHOLD,
  SD3_NARCISSISM_STRAIGHT_LINE_FLAG,
  wouldTriggerSd3NarcissismFloor,
} from './sd3NarcissismFloor';
import {
  formatNpiEntitlementFloorAdminDescription,
  isRetroactiveNpiEntitlementFloorReview,
  NPI_ENTITLEMENT_FLOOR_FAIL_CODE,
  wouldTriggerNpiEntitlementFloor,
} from './npiEntitlementFloor';
import { NPI_ENTITLEMENT_ENABLED } from './interviewCompletionStatus';
import { coercePsychometricScore } from './usersPsychometricsSchemaFallback';

export const RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_THRESHOLD = 2.0;
export const RFQ_STRAIGHT_LINE_FLAG = 'rfq_straight_line';
export const RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE = 'rfq_low_reflective_functioning_floor';
export const RFQ_ITEM_COUNT = 8;

export const GASP_EXTREME_EXTERNALIZATION_FLOOR_THRESHOLD = 4.6;
export const GASP_STRAIGHT_LINE_FLAG = 'gasp_straight_line';
export const GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE = 'gasp_extreme_externalization_floor';

export const DWECK_EXTREME_FIXED_MINDSET_FLOOR_THRESHOLD = 2.4;
export const DWECK_STRAIGHT_LINE_FLAG = 'dweck_straight_line';
export const DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE = 'dweck_extreme_fixed_mindset_floor';
export const DWECK_ITEM_COUNT = 10;

export const SCS_SF_LOW_SELF_COMPASSION_FLOOR_THRESHOLD = 2.5;
export const SCS_SF_STRAIGHT_LINE_FLAG = 'scs_sf_straight_line';
export const SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE = 'scs_sf_low_self_compassion_floor';

export const BRS_LOW_RESILIENCE_FLOOR_THRESHOLD = 1.8;
export const BRS_STRAIGHT_LINE_FLAG = 'brs_straight_line';
export const BRS_LOW_RESILIENCE_FLOOR_CODE = 'brs_low_resilience_floor';

export const ANXIETY_TRAIT_HIGH_FLOOR_THRESHOLD = 4.9;
export const ANXIETY_TRAIT_STRAIGHT_LINE_FLAG = 'anxiety_trait_straight_line';
export const ANXIETY_TRAIT_HIGH_FLOOR_CODE = 'anxiety_trait_high_floor';

export const AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_THRESHOLD = 33;
export const AAQ2_STRAIGHT_LINE_FLAG = 'aaq2_straight_line';
export const AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE = 'aaq2_high_experiential_avoidance_floor';

/** RSES sum score (10 items × 1–4); range 10–40. */
export const RSES_LOW_SELF_ESTEEM_FLOOR_THRESHOLD = 24;
export const RSES_STRAIGHT_LINE_FLAG = 'rses_straight_line';
export const RSES_LOW_SELF_ESTEEM_FLOOR_CODE = 'rses_low_self_esteem_floor';

/** @deprecated Retired SCS instrument — constants kept for legacy gate_fail_detail only. */
export const SCS_PUBLIC_HIGH_SELF_CONSCIOUSNESS_FLOOR_THRESHOLD = 17;
/** @deprecated Retired SCS instrument — constants kept for legacy gate_fail_detail only. */
export const SCS_PRIVATE_LOW_SELF_AWARENESS_FLOOR_THRESHOLD = 10;
/** @deprecated Retired SCS instrument — no longer collected for new attempts. */
export const SCS_STRAIGHT_LINE_FLAG = 'scs_straight_line';
/** @deprecated Retired SCS instrument — no longer collected for new attempts. */
export const SCS_LOW_PRIVATE_SELF_AWARENESS_FLOOR_CODE = 'scs_low_private_self_awareness_floor';

export type PsychometricFloorUserScores = {
  rfqScore: number | null;
  gaspScore: number | null;
  dweckScore: number | null;
  scsSfScore: number | null;
  sd3NarcissismScore: number | null;
  npiEntitlementScore: number | null;
  brsScore: number | null;
  anxietyTraitScore: number | null;
  aaq2Score: number | null;
  rsesScore: number | null;
  scsPublicScore: number | null;
  scsPrivateScore: number | null;
};

export type PsychometricFloorReview = {
  id: string;
  score: number;
  description: string;
  retroactiveNote: string;
};

export function detectRfqStraightLineFromResponses(
  responses: Record<number, number> | undefined,
): boolean {
  if (!responses) return false;
  const values = Object.values(responses);
  return values.length === RFQ_ITEM_COUNT && new Set(values).size === 1;
}

export function wouldTriggerRfqLowReflectiveFunctioningFloor(
  rfqScore: number | null,
  _straightLineFlags?: string[] | null | undefined,
): boolean {
  if (rfqScore === null || !Number.isFinite(rfqScore)) return false;
  if (rfqScore >= RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_THRESHOLD) return false;
  return true;
}

export function wouldTriggerGaspExtremeExternalizationFloor(
  gaspScore: number | null,
  _straightLineFlags?: string[] | null | undefined,
): boolean {
  if (gaspScore === null || !Number.isFinite(gaspScore)) return false;
  if (gaspScore < GASP_EXTREME_EXTERNALIZATION_FLOOR_THRESHOLD) return false;
  return true;
}

export function wouldTriggerDweckExtremeFixedMindsetFloor(
  dweckScore: number | null,
  _straightLineFlags?: string[] | null | undefined,
): boolean {
  if (dweckScore === null || !Number.isFinite(dweckScore)) return false;
  if (dweckScore >= DWECK_EXTREME_FIXED_MINDSET_FLOOR_THRESHOLD) return false;
  return true;
}

export function wouldTriggerScsSfLowSelfCompassionFloor(
  scsSfScore: number | null,
  _straightLineFlags?: string[] | null | undefined,
): boolean {
  if (scsSfScore === null || !Number.isFinite(scsSfScore)) return false;
  if (scsSfScore >= SCS_SF_LOW_SELF_COMPASSION_FLOOR_THRESHOLD) return false;
  return true;
}

export function wouldTriggerBrsLowResilienceFloor(
  brsScore: number | null,
  _straightLineFlags?: string[] | null | undefined,
): boolean {
  if (brsScore === null || !Number.isFinite(brsScore)) return false;
  if (brsScore > BRS_LOW_RESILIENCE_FLOOR_THRESHOLD) return false;
  return true;
}

export function wouldTriggerAnxietyTraitHighFloor(
  anxietyTraitScore: number | null,
  _straightLineFlags?: string[] | null | undefined,
): boolean {
  if (anxietyTraitScore === null || !Number.isFinite(anxietyTraitScore)) return false;
  if (anxietyTraitScore < ANXIETY_TRAIT_HIGH_FLOOR_THRESHOLD) return false;
  return true;
}

export function wouldTriggerAaq2HighExperientialAvoidanceFloor(
  aaq2Score: number | null,
  _straightLineFlags?: string[] | null | undefined,
): boolean {
  if (aaq2Score === null || !Number.isFinite(aaq2Score)) return false;
  if (aaq2Score < AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_THRESHOLD) return false;
  return true;
}

export function wouldTriggerRsesLowSelfEsteemFloor(
  rsesScore: number | null,
  _straightLineFlags?: string[] | null | undefined,
): boolean {
  if (rsesScore === null || !Number.isFinite(rsesScore)) return false;
  if (rsesScore > RSES_LOW_SELF_ESTEEM_FLOOR_THRESHOLD) return false;
  return true;
}

export function wouldTriggerScsLowPrivateSelfAwarenessFloor(
  scsPublicScore: number | null,
  scsPrivateScore: number | null,
  _straightLineFlags?: string[] | null | undefined,
): boolean {
  if (scsPublicScore === null || !Number.isFinite(scsPublicScore)) return false;
  if (scsPrivateScore === null || !Number.isFinite(scsPrivateScore)) return false;
  if (scsPublicScore < SCS_PUBLIC_HIGH_SELF_CONSCIOUSNESS_FLOOR_THRESHOLD) return false;
  if (scsPrivateScore > SCS_PRIVATE_LOW_SELF_AWARENESS_FLOOR_THRESHOLD) return false;
  return true;
}

export function formatRfqLowReflectiveFunctioningFloorAdminDescription(rfqScore: number): string {
  return `RFQ score of ${rfqScore.toFixed(2)} is below the automatic fail threshold of ${RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_THRESHOLD.toFixed(1)}. User self-reported a fundamental inability to understand their own or others' mental states — cannot link past experiences to current feelings, cannot understand why people behave as they do, and acts without thinking about motivations. This level of psychological opacity is incompatible with the emotional intimacy required for committed partnership.`;
}

export function formatGaspExtremeExternalizationFloorAdminDescription(gaspScore: number): string {
  return `GASP 4-item externalization subscale score of ${gaspScore.toFixed(2)} meets or exceeds the automatic fail threshold of ${GASP_EXTREME_EXTERNALIZATION_FLOOR_THRESHOLD.toFixed(1)}. User self-reported near-complete absence of personal accountability — consistently endorsing blame attribution to others after their own wrongdoing at a level incompatible with healthy relational functioning. The existing modifier penalty is insufficient to capture the severity of this pattern.`;
}

export function formatDweckExtremeFixedMindsetFloorAdminDescription(dweckScore: number): string {
  return `Relationship Beliefs score of ${dweckScore.toFixed(2)} is below the automatic fail threshold of ${DWECK_EXTREME_FIXED_MINDSET_FLOOR_THRESHOLD.toFixed(1)}. User self-reported a fundamental belief that people and relationship patterns cannot change, and that disagreement signals incompatibility. This belief system is incompatible with the growth orientation required for sustainable partnership and strongly suggests limited personal development work. Someone who sees people as static has likely not experienced meaningful change in themselves.`;
}

export function formatScsSfLowSelfCompassionFloorAdminDescription(scsSfScore: number): string {
  return `SCS-SF self-compassion score of ${scsSfScore.toFixed(2)} is below the automatic fail threshold of ${SCS_SF_LOW_SELF_COMPASSION_FLOOR_THRESHOLD.toFixed(1)}. User self-reported being almost always self-judgmental, intolerant of their own imperfections, and unable to treat themselves with kindness under difficulty. Very low self-compassion indicates limited shadow work completion and an active inner critic that would significantly impact intimate partnership — both through self-critical spirals during relational difficulty and through projection of harsh self-judgment onto a partner.`;
}

export function formatBrsLowResilienceFloorAdminDescription(brsScore: number): string {
  return `BRS resilience score of ${brsScore.toFixed(2)} is at or below the automatic fail threshold of ${BRS_LOW_RESILIENCE_FLOOR_THRESHOLD.toFixed(1)}. User self-reported near-complete inability to bounce back from adversity or stress — consistently endorsing the lowest resilience items. This level of stress fragility poses meaningful risk for intimate partnership functioning under normal life stressors.`;
}

export function formatAnxietyTraitHighFloorAdminDescription(anxietyTraitScore: number): string {
  return `Anxiety Trait score of ${anxietyTraitScore.toFixed(1)} meets or exceeds the automatic fail threshold of ${ANXIETY_TRAIT_HIGH_FLOOR_THRESHOLD.toFixed(1)}. User self-reported near-maximum chronic trait anxiety — pervasive worry, tension, and inability to feel calm. At this severity level trait anxiety significantly impairs co-regulation capacity in intimate partnership.`;
}

export function formatAaq2HighExperientialAvoidanceFloorAdminDescription(aaq2Score: number): string {
  return `AAQ-II experiential avoidance sum score of ${aaq2Score.toFixed(0)} meets or exceeds the automatic fail threshold of ${AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_THRESHOLD.toFixed(0)}. User self-reported chronic psychological inflexibility and pervasive avoidance of difficult internal experience — directly predicts emotional withdrawal and stonewalling in relational conflict.`;
}

export function formatRsesLowSelfEsteemFloorAdminDescription(rsesScore: number): string {
  return `Rosenberg Self-Esteem sum score of ${rsesScore.toFixed(0)} is at or below the automatic fail threshold of ${RSES_LOW_SELF_ESTEEM_FLOOR_THRESHOLD.toFixed(0)}. User self-reported consistently low self-worth across nearly all self-esteem items, predicting reassurance-seeking, partner-burdening, and anxious relational dynamics.`;
}

export function formatScsLowPrivateSelfAwarenessFloorAdminDescription(
  scsPublicScore: number,
  scsPrivateScore: number,
): string {
  return `SCS public self-consciousness subscale score of ${scsPublicScore.toFixed(0)} meets or exceeds the automatic fail threshold of ${SCS_PUBLIC_HIGH_SELF_CONSCIOUSNESS_FLOOR_THRESHOLD.toFixed(0)} while private self-awareness subscale score of ${scsPrivateScore.toFixed(0)} is at or below the automatic fail threshold of ${SCS_PRIVATE_LOW_SELF_AWARENESS_FLOOR_THRESHOLD.toFixed(0)}. User self-reported high focus on external appearance and social evaluation alongside low awareness of internal states. This combination predicts superficiality and poor emotional self-awareness in intimate partnership.`;
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

export const ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES = [
  RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
  GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE,
  DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE,
  SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE,
  BRS_LOW_RESILIENCE_FLOOR_CODE,
  ANXIETY_TRAIT_HIGH_FLOOR_CODE,
  AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE,
  RSES_LOW_SELF_ESTEEM_FLOOR_CODE,
  SD3_NARCISSISM_FLOOR_FAIL_CODE,
  NPI_ENTITLEMENT_FLOOR_FAIL_CODE,
] as const;

export type PsychometricGateFailFloorCode = (typeof ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES)[number];

export function isPsychometricGateFailFloorCode(id: string): id is PsychometricGateFailFloorCode {
  return (ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES as readonly string[]).includes(id);
}

/** Single source of truth for gate_fail_reasons and uncertainty activeFlags. */
export function collectPsychometricFloorGateFailReasons(
  scores: PsychometricFloorUserScores,
  straightLineFlags: string[] | null | undefined,
): string[] {
  return collectPsychometricFloorUncertaintyFlags(scores, straightLineFlags);
}

/** Telemetry for floor gating — scores evaluated at mergePsychometricFloorsIntoGateState time. */
export function logPsychometricFloorEvaluation(
  context: { attemptId?: string; userId?: string },
  scores: PsychometricFloorUserScores,
  straightLineFlags: string[] | null | undefined,
): void {
  const rfqWould = wouldTriggerRfqLowReflectiveFunctioningFloor(scores.rfqScore, straightLineFlags);
  const sd3Would = wouldTriggerSd3NarcissismFloor(scores.sd3NarcissismScore, straightLineFlags);
  const npiWould = wouldTriggerNpiEntitlementFloor(scores.npiEntitlementScore);
  if (__DEV__ || rfqWould || sd3Would || npiWould) {
    console.log('[PsychometricFloor]', {
      ...context,
      psychometrics_rfq_score: scores.rfqScore,
      rfq_low_reflective_functioning_floor: rfqWould,
      straightLineFlags: straightLineFlags ?? [],
      sd3_narcissism_score_effective: scores.sd3NarcissismScore,
      sd3_narcissism_floor: sd3Would,
      npi_entitlement_score_effective: scores.npiEntitlementScore,
      npi_entitlement_floor: npiWould,
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
  if (wouldTriggerBrsLowResilienceFloor(scores.brsScore, straightLineFlags)) {
    flags.push(BRS_LOW_RESILIENCE_FLOOR_CODE);
  }
  if (wouldTriggerAnxietyTraitHighFloor(scores.anxietyTraitScore, straightLineFlags)) {
    flags.push(ANXIETY_TRAIT_HIGH_FLOOR_CODE);
  }
  if (wouldTriggerAaq2HighExperientialAvoidanceFloor(scores.aaq2Score, straightLineFlags)) {
    flags.push(AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE);
  }
  if (wouldTriggerRsesLowSelfEsteemFloor(scores.rsesScore, straightLineFlags)) {
    flags.push(RSES_LOW_SELF_ESTEEM_FLOOR_CODE);
  }
  if (NPI_ENTITLEMENT_ENABLED) {
    if (wouldTriggerNpiEntitlementFloor(scores.npiEntitlementScore)) {
      flags.push(NPI_ENTITLEMENT_FLOOR_FAIL_CODE);
    }
  } else {
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
  }
  return flags;
}

export function formatPsychometricGateFailDescription(
  floorId: string,
  score: number,
  allScores?: PsychometricFloorUserScores,
): string {
  switch (floorId) {
    case RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE:
      return formatRfqLowReflectiveFunctioningFloorAdminDescription(score);
    case GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE:
      return formatGaspExtremeExternalizationFloorAdminDescription(score);
    case DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE:
      return formatDweckExtremeFixedMindsetFloorAdminDescription(score);
    case SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE:
      return formatScsSfLowSelfCompassionFloorAdminDescription(score);
    case BRS_LOW_RESILIENCE_FLOOR_CODE:
      return formatBrsLowResilienceFloorAdminDescription(score);
    case ANXIETY_TRAIT_HIGH_FLOOR_CODE:
      return formatAnxietyTraitHighFloorAdminDescription(score);
    case AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE:
      return formatAaq2HighExperientialAvoidanceFloorAdminDescription(score);
    case RSES_LOW_SELF_ESTEEM_FLOOR_CODE:
      return formatRsesLowSelfEsteemFloorAdminDescription(score);
    case SCS_LOW_PRIVATE_SELF_AWARENESS_FLOOR_CODE: {
      const pub = allScores?.scsPublicScore;
      const priv = allScores?.scsPrivateScore;
      if (pub != null && priv != null && Number.isFinite(pub) && Number.isFinite(priv)) {
        return formatScsLowPrivateSelfAwarenessFloorAdminDescription(pub, priv);
      }
      return formatScsLowPrivateSelfAwarenessFloorAdminDescription(score, score);
    }
    case SD3_NARCISSISM_FLOOR_FAIL_CODE:
      return formatSd3NarcissismFloorAdminDescription(score);
    case NPI_ENTITLEMENT_FLOOR_FAIL_CODE:
      return formatNpiEntitlementFloorAdminDescription(score);
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
  scores: PsychometricFloorUserScores,
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
    case BRS_LOW_RESILIENCE_FLOOR_CODE:
      return coercePsychometricScore(scores.brsScore);
    case ANXIETY_TRAIT_HIGH_FLOOR_CODE:
      return coercePsychometricScore(scores.anxietyTraitScore);
    case AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE:
      return coercePsychometricScore(scores.aaq2Score);
    case RSES_LOW_SELF_ESTEEM_FLOOR_CODE:
      return coercePsychometricScore(scores.rsesScore);
    case SCS_LOW_PRIVATE_SELF_AWARENESS_FLOOR_CODE: {
      const pub = coercePsychometricScore(scores.scsPublicScore);
      const priv = coercePsychometricScore(scores.scsPrivateScore);
      if (pub == null || priv == null) return null;
      // Public subscale is the primary breached threshold; description carries both subscales.
      return pub;
    }
    case SD3_NARCISSISM_FLOOR_FAIL_CODE:
      return coercePsychometricScore(scores.sd3NarcissismScore);
    case NPI_ENTITLEMENT_FLOOR_FAIL_CODE:
      return coercePsychometricScore(scores.npiEntitlementScore);
    default:
      return null;
  }
}

export function buildPsychometricGateFailDetail(
  floorIds: string[],
  scores: PsychometricFloorUserScores,
): Record<string, PsychometricFloorDetailEntry> {
  const detail: Record<string, PsychometricFloorDetailEntry> = {};
  for (const floorId of floorIds) {
    if (!isPsychometricGateFailFloorCode(floorId)) continue;
    const score = psychometricFloorScoreForGateDetail(floorId, scores);
    if (score == null || !Number.isFinite(score)) continue;
    detail[floorId] = {
      score,
      description: formatPsychometricGateFailDescription(floorId, score, scores),
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
  scores: PsychometricFloorUserScores,
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
      description: formatPsychometricGateFailDescription(floorId, score, scores),
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
  scores: PsychometricFloorUserScores,
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
  attemptId?: string;
  userId?: string;
}): { gateFailReasons: string[]; gateFailDetail: Record<string, unknown> } {
  logPsychometricFloorEvaluation(
    { attemptId: opts.attemptId, userId: opts.userId },
    opts.scores,
    opts.straightLineFlags,
  );
  const floorBreaches = collectPsychometricFloorGateFailReasons(opts.scores, opts.straightLineFlags);
  const interviewFailReasons = opts.existingFailReasons.filter((code) => !isPsychometricGateFailFloorCode(code));
  const gateFailReasons = [...new Set([...interviewFailReasons, ...floorBreaches])];
  const priorDetail =
    opts.existingDetail != null && typeof opts.existingDetail === 'object' && !Array.isArray(opts.existingDetail)
      ? opts.existingDetail
      : {};
  const rawPriorPsychFloors = priorDetail.psychometric_floors;
  const priorPsychFloors = normalizePsychometricFloorsGateDetail(rawPriorPsychFloors, opts.scores);
  const psychometric_floors = finalizePsychometricFloorsGateDetail(
    mergePsychometricFloorsDetailEntries(floorBreaches, opts.scores, priorPsychFloors),
    floorBreaches,
    opts.scores,
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
  BRS_LOW_RESILIENCE_FLOOR_CODE,
  ANXIETY_TRAIT_HIGH_FLOOR_CODE,
  AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE,
  RSES_LOW_SELF_ESTEEM_FLOOR_CODE,
  SD3_NARCISSISM_FLOOR_FAIL_CODE,
] as const;

export type PsychometricGateFailFloorId = (typeof PSYCHOMETRIC_GATE_FAIL_FLOOR_IDS)[number];

export function psychometricFloorScoreForUser(
  floorId: string,
  user: PsychometricFloorUserScores,
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
    {
      id: BRS_LOW_RESILIENCE_FLOOR_CODE,
      score: scores.brsScore,
      wouldTrigger: wouldTriggerBrsLowResilienceFloor(scores.brsScore, straightLineFlags),
      description: formatBrsLowResilienceFloorAdminDescription,
    },
    {
      id: ANXIETY_TRAIT_HIGH_FLOOR_CODE,
      score: scores.anxietyTraitScore,
      wouldTrigger: wouldTriggerAnxietyTraitHighFloor(scores.anxietyTraitScore, straightLineFlags),
      description: formatAnxietyTraitHighFloorAdminDescription,
    },
    {
      id: AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_CODE,
      score: scores.aaq2Score,
      wouldTrigger: wouldTriggerAaq2HighExperientialAvoidanceFloor(scores.aaq2Score, straightLineFlags),
      description: formatAaq2HighExperientialAvoidanceFloorAdminDescription,
    },
    {
      id: RSES_LOW_SELF_ESTEEM_FLOOR_CODE,
      score: scores.rsesScore,
      wouldTrigger: wouldTriggerRsesLowSelfEsteemFloor(scores.rsesScore, straightLineFlags),
      description: formatRsesLowSelfEsteemFloorAdminDescription,
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

  if (NPI_ENTITLEMENT_ENABLED) {
    if (
      scores.npiEntitlementScore != null &&
      Number.isFinite(scores.npiEntitlementScore) &&
      isRetroactiveNpiEntitlementFloorReview(attempt, scores.npiEntitlementScore)
    ) {
      reviews.push({
        id: NPI_ENTITLEMENT_FLOOR_FAIL_CODE,
        score: scores.npiEntitlementScore,
        description: formatNpiEntitlementFloorAdminDescription(scores.npiEntitlementScore),
        retroactiveNote: retroactivePsychometricFloorReviewNote(NPI_ENTITLEMENT_FLOOR_FAIL_CODE),
      });
    }
  } else if (
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
