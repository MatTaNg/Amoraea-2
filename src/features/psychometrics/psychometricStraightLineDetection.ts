import {
  AAQ2_STRAIGHT_LINE_UNIQUE_MAX,
  SCS_STRAIGHT_LINE_UNIQUE_MAX,
} from '@config/psychometrics/modifierBandPenalties';
import {
  ASSESSMENTS,
  GASP_EXTERNALIZATION_ITEM_IDS,
  isUnfavorableLikertItemResponse,
  scoreLikertItemValue,
  type AssessmentId,
} from './assessmentContent';
import { coercePsychometricScore } from './usersPsychometricsSchemaFallback';
import {
  AAQ2_STRAIGHT_LINE_FLAG,
  ANXIETY_TRAIT_STRAIGHT_LINE_FLAG,
  BRS_STRAIGHT_LINE_FLAG,
  DWECK_ITEM_COUNT,
  DWECK_STRAIGHT_LINE_FLAG,
  GASP_STRAIGHT_LINE_FLAG,
  RSES_STRAIGHT_LINE_FLAG,
  RFQ_STRAIGHT_LINE_FLAG,
  SCS_SF_STRAIGHT_LINE_FLAG,
  SCS_STRAIGHT_LINE_FLAG,
  detectRfqStraightLineFromResponses,
} from './psychometricFloorBreaches';
import {
  detectSd3NarcissismStraightLineFromResponses,
  SD3_NARCISSISM_STRAIGHT_LINE_FLAG,
} from './sd3NarcissismFloor';
import { sd3NarcissismResponsesFromUserRow } from './usersPsychometricsSchemaFallback';

export const RSES_ITEM_COUNT = 10;
export const RSES_MAX_SUM_SCORE = 40;
export const RSES_MIN_SUM_SCORE = 10;

export const AAQ2_ITEM_COUNT = 7;
export const AAQ2_MAX_SUM_SCORE = 49;
export const AAQ2_MIN_SUM_SCORE = 7;

export const GASP_ITEM_COUNT = 8;
export const BRS_ITEM_COUNT = 6;
export const ANXIETY_TRAIT_ITEM_COUNT = 4;
export const SCS_SF_ITEM_COUNT = 8;

type LikertAssessment = (typeof ASSESSMENTS)[AssessmentId];

/** Coerce PostgREST JSON maps (`"1"` keys) into numeric item ids. */
export function normalizePsychometricResponseMap(raw: unknown): Record<number, number> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<number, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(key);
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(id) && Number.isFinite(num)) out[id] = num;
  }
  return out;
}

function normalizePsychometricResponseMapOrUndefined(
  raw: unknown,
): Record<number, number> | undefined {
  const normalized = normalizePsychometricResponseMap(raw);
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function answeredItemIds(
  responses: Record<number, number>,
  expectedIds: readonly number[],
): number[] {
  return expectedIds.filter((id) => responses[id] != null);
}

function rawUniqueCount(responses: Record<number, number>, itemIds: number[]): number {
  return new Set(itemIds.map((id) => responses[id]!)).size;
}

function keyedUniqueCount(
  assessment: LikertAssessment,
  responses: Record<number, number>,
  itemIds: number[],
): number {
  const keyed = itemIds.map((id) => scoreLikertItemValue(assessment, id, responses[id]!));
  return new Set(keyed).size;
}

function detectUniformRawStraightLine(
  responses: Record<number, number>,
  expectedCount: number,
  expectedIds: readonly number[],
): boolean {
  const answered = answeredItemIds(responses, expectedIds);
  if (answered.length < expectedCount) return false;
  return rawUniqueCount(responses, answered) === 1;
}

function detectLowRawVarianceStraightLine(
  responses: Record<number, number>,
  expectedCount: number,
  expectedIds: readonly number[],
  uniqueMax: number,
): boolean {
  const answered = answeredItemIds(responses, expectedIds);
  if (answered.length < expectedCount) return false;
  return rawUniqueCount(responses, answered) <= uniqueMax;
}

function detectKeyedUniformStraightLine(
  assessmentId: AssessmentId,
  responses: Record<number, number>,
  expectedCount: number,
  expectedIds: readonly number[],
): boolean {
  const answered = answeredItemIds(responses, expectedIds);
  if (answered.length < expectedCount) return false;
  const assessment = ASSESSMENTS[assessmentId];
  return keyedUniqueCount(assessment, responses, answered) <= 1;
}

function detectAlternatingLikertStraightLine(
  assessmentId: AssessmentId,
  responses: Record<number, number>,
  expectedCount: number,
  expectedIds: readonly number[],
): boolean {
  const answered = answeredItemIds(responses, expectedIds);
  if (answered.length < expectedCount) return false;
  const assessment = ASSESSMENTS[assessmentId];
  if (detectUniformRawStraightLine(responses, expectedCount, expectedIds)) return true;
  if (detectKeyedUniformStraightLine(assessmentId, responses, expectedCount, expectedIds)) {
    return true;
  }
  const allUnfavorable = answered.every((id) =>
    isUnfavorableLikertItemResponse(assessmentId, assessment, id, responses[id]!),
  );
  const allFavorable = answered.every(
    (id) => !isUnfavorableLikertItemResponse(assessmentId, assessment, id, responses[id]!),
  );
  return allUnfavorable || allFavorable;
}

/**
 * RSES straight-line must use raw Likert values, not keyed scores.
 * Reverse-scored items turn a uniform raw response into alternating keyed values,
 * so keyed-variance checks miss genuine straight-lining.
 */
function detectRsesRawResponseStraightLine(responses: Record<number, number>): boolean {
  const itemIds = ASSESSMENTS.rses.questions.map((q) => q.id);
  const answered = answeredItemIds(responses, itemIds);
  if (answered.length === 0) return false;

  // Zero variance across raw item responses (all 1s, 2s, 3s, or 4s).
  return rawUniqueCount(responses, answered) === 1;
}

export function detectRsesStraightLine(score: unknown, rawResponses: unknown): boolean {
  const sumScore = coercePsychometricScore(score);
  if (sumScore === RSES_MAX_SUM_SCORE || sumScore === RSES_MIN_SUM_SCORE) return true;

  const responses = normalizePsychometricResponseMap(rawResponses);
  return detectRsesRawResponseStraightLine(responses);
}

export function detectAaq2StraightLine(
  score: number | null,
  rawResponses: unknown,
): boolean {
  const sumScore = coercePsychometricScore(score);
  if (sumScore === AAQ2_MAX_SUM_SCORE || sumScore === AAQ2_MIN_SUM_SCORE) return true;

  const responses = normalizePsychometricResponseMap(rawResponses);
  const itemIds = ASSESSMENTS.aaq2.questions.map((q) => q.id);
  return detectLowRawVarianceStraightLine(
    responses,
    AAQ2_ITEM_COUNT,
    itemIds,
    AAQ2_STRAIGHT_LINE_UNIQUE_MAX,
  );
}

export function detectGaspStraightLine(rawResponses: unknown): boolean {
  const responses = normalizePsychometricResponseMap(rawResponses);
  const itemIds = ASSESSMENTS.gasp.questions.map((q) => q.id);
  if (detectUniformRawStraightLine(responses, GASP_ITEM_COUNT, itemIds)) return true;

  const assessment = ASSESSMENTS.gasp;
  const extAnswered = answeredItemIds(responses, GASP_EXTERNALIZATION_ITEM_IDS);
  if (extAnswered.length === GASP_EXTERNALIZATION_ITEM_IDS.length) {
    const allExternalizationUnfavorable = extAnswered.every((id) =>
      isUnfavorableLikertItemResponse('gasp', assessment, id, responses[id]!),
    );
    if (allExternalizationUnfavorable) return true;
  }

  return detectKeyedUniformStraightLine('gasp', responses, GASP_ITEM_COUNT, itemIds);
}

export type PsychometricRawResponses = {
  brs?: Record<number, number>;
  anxiety_trait?: Record<number, number>;
  scs_sf?: Record<number, number>;
  gasp?: Record<number, number>;
  dweck?: Record<number, number>;
  aaq2?: Record<number, number>;
  rses?: Record<number, number>;
  scs?: Record<number, number>;
  mspss?: Record<number, number>;
  sd3_narcissism?: Record<number, number>;
  rfq?: Record<number, number>;
};

export function detectPsychometricStraightLineFlags(
  scores: {
    brsScore: number | null;
    anxietyTraitScore: number | null;
    scsSfScore: number | null;
    gaspScore: number | null;
    dweckScore: number | null;
    aaq2Score: number | null;
    rsesScore: number | null;
    scsPublicScore: number | null;
    scsPrivateScore: number | null;
    mspssFriendsScore: number | null;
    sd3NarcissismScore: number | null;
    rfqScore: number | null;
  },
  rawResponses?: PsychometricRawResponses,
): string[] {
  const flags: string[] = [];
  const responses = rawResponses ?? {};

  if (scores.brsScore != null && responses.brs) {
    const brsIds = ASSESSMENTS.brs.questions.map((q) => q.id);
    if (detectAlternatingLikertStraightLine('brs', responses.brs, BRS_ITEM_COUNT, brsIds)) {
      flags.push(BRS_STRAIGHT_LINE_FLAG);
    }
  }

  if (scores.anxietyTraitScore != null && responses.anxiety_trait) {
    const anxietyIds = ASSESSMENTS.anxiety_trait.questions.map((q) => q.id);
    if (
      detectAlternatingLikertStraightLine(
        'anxiety_trait',
        responses.anxiety_trait,
        ANXIETY_TRAIT_ITEM_COUNT,
        anxietyIds,
      )
    ) {
      flags.push(ANXIETY_TRAIT_STRAIGHT_LINE_FLAG);
    }
  }

  if (scores.scsSfScore != null && responses.scs_sf) {
    const scsSfIds = ASSESSMENTS.scs_sf.questions.map((q) => q.id);
    if (
      detectAlternatingLikertStraightLine('scs_sf', responses.scs_sf, SCS_SF_ITEM_COUNT, scsSfIds)
    ) {
      flags.push(SCS_SF_STRAIGHT_LINE_FLAG);
    }
  }

  if (scores.gaspScore != null && detectGaspStraightLine(responses.gasp)) {
    flags.push(GASP_STRAIGHT_LINE_FLAG);
  }

  if (scores.dweckScore != null && responses.dweck) {
    const dweckIds = ASSESSMENTS.dweck.questions.map((q) => q.id);
    if (detectUniformRawStraightLine(responses.dweck, DWECK_ITEM_COUNT, dweckIds)) {
      flags.push(DWECK_STRAIGHT_LINE_FLAG);
    }
  }

  const aaq2Score = coercePsychometricScore(scores.aaq2Score);
  if (aaq2Score != null && detectAaq2StraightLine(aaq2Score, responses.aaq2)) {
    flags.push(AAQ2_STRAIGHT_LINE_FLAG);
  }

  const rsesScore = coercePsychometricScore(scores.rsesScore);
  if (rsesScore != null && detectRsesStraightLine(rsesScore, responses.rses)) {
    flags.push(RSES_STRAIGHT_LINE_FLAG);
  }

  if (scores.scsPublicScore != null && scores.scsPrivateScore != null && responses.scs) {
    const scsIds = Array.from({ length: 26 }, (_, i) => i + 1);
    if (
      detectLowRawVarianceStraightLine(
        responses.scs,
        scsIds.length,
        scsIds,
        SCS_STRAIGHT_LINE_UNIQUE_MAX,
      )
    ) {
      flags.push(SCS_STRAIGHT_LINE_FLAG);
    }
  }

  if (scores.mspssFriendsScore != null && responses.mspss) {
    const values = Object.values(responses.mspss);
    if (values.length === 8 && new Set(values).size === 1 && (values[0] === 1 || values[0] === 7)) {
      flags.push('mspss_straight_line');
    }
  }

  if (
    scores.sd3NarcissismScore != null &&
    responses.sd3_narcissism &&
    detectSd3NarcissismStraightLineFromResponses(responses.sd3_narcissism)
  ) {
    flags.push(SD3_NARCISSISM_STRAIGHT_LINE_FLAG);
  }

  if (
    scores.rfqScore != null &&
    responses.rfq &&
    detectRfqStraightLineFromResponses(responses.rfq)
  ) {
    flags.push(RFQ_STRAIGHT_LINE_FLAG);
  }

  return flags;
}

function mergeScsResponses(
  publicResponses: Record<number, number> | undefined,
  privateResponses: Record<number, number> | undefined,
): Record<number, number> | undefined {
  if (!publicResponses && !privateResponses) return undefined;
  return { ...(publicResponses ?? {}), ...(privateResponses ?? {}) };
}

/** Normalize per-instrument response JSON from a `users` row for straight-line detection. */
export function psychometricRawResponsesFromUserRow(
  user: Record<string, unknown>,
): PsychometricRawResponses {
  const sd3Raw = sd3NarcissismResponsesFromUserRow(user);
  return {
    brs: normalizePsychometricResponseMapOrUndefined(user.psychometrics_brs_responses),
    anxiety_trait: normalizePsychometricResponseMapOrUndefined(
      user.psychometrics_anxiety_trait_responses,
    ),
    scs_sf: normalizePsychometricResponseMapOrUndefined(user.psychometrics_scs_sf_responses),
    gasp: normalizePsychometricResponseMapOrUndefined(user.psychometrics_gasp_responses),
    dweck: normalizePsychometricResponseMapOrUndefined(user.psychometrics_dweck_responses),
    aaq2: normalizePsychometricResponseMapOrUndefined(user.psychometrics_aaq2_responses),
    rses: normalizePsychometricResponseMapOrUndefined(user.psychometrics_rses_responses),
    scs: mergeScsResponses(
      normalizePsychometricResponseMapOrUndefined(user.psychometrics_scs_public_responses),
      normalizePsychometricResponseMapOrUndefined(user.psychometrics_scs_private_responses),
    ),
    mspss: normalizePsychometricResponseMapOrUndefined(user.psychometrics_mspss_responses),
    sd3_narcissism: normalizePsychometricResponseMapOrUndefined(sd3Raw),
    rfq: normalizePsychometricResponseMapOrUndefined(user.psychometrics_rfq_responses),
  };
}
