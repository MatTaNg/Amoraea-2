/** Bridge unmigrated DBs (NARQ-S columns) and migrated DBs (SD3 narcissism columns). */

import type { PsychometricFloorUserScores } from './psychometricFloorBreaches';
// type-only import — avoids circular dependency with psychometricFloorBreaches runtime

/** PostgREST / SQL `numeric` often arrives as string — floors must coerce before `Number.isFinite` checks. */
export function coercePsychometricScore(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function concatPostgrestError(error: {
  code?: string | number;
  message?: string;
  details?: string;
  hint?: string;
} | null): string {
  if (!error) return '';
  return [error.message, error.details, error.hint, String(error.code ?? '')].filter(Boolean).join(' ');
}

export function isMissingUsersPsychometricsSd3ColumnsError(error: {
  code?: string | number;
  message?: string;
  details?: string;
  hint?: string;
} | null): boolean {
  if (!error) return false;
  const msg = [error.message, error.details, error.hint, String(error.code ?? '')]
    .filter(Boolean)
    .join(' ');
  if (
    (String(error.code) === 'PGRST204' || String(error.code) === '42703') &&
    msg.includes('psychometrics_sd3_narcissism')
  ) {
    return true;
  }
  return (
    msg.includes('psychometrics_sd3_narcissism') &&
    (msg.includes('does not exist') || msg.includes('schema cache'))
  );
}

export function sd3NarcissismPrimarySavePayload(
  responses: Record<number, number>,
  score: number,
): Record<string, unknown> {
  return {
    psychometrics_sd3_narcissism_responses: responses,
    psychometrics_sd3_narcissism_score: score,
  };
}

/** Legacy columns from 20260628120000_users_psychometrics_narq_rfq_dweck_subscales.sql */
export function sd3NarcissismLegacyNarqSavePayload(
  responses: Record<number, number>,
  score: number,
): Record<string, unknown> {
  return {
    psychometrics_narq_s_responses: responses,
    psychometrics_narq_s_score: score,
  };
}

export function sd3NarcissismResponsesFromUserRow(row: Record<string, unknown>): unknown {
  return row.psychometrics_sd3_narcissism_responses ?? row.psychometrics_narq_s_responses ?? null;
}

/**
 * SD3 narcissism mean for modifier / uncertainty. Prefers `psychometrics_sd3_narcissism_score`;
 * falls back to `psychometrics_narq_s_score` when SD3 migration is not applied (same instrument data).
 */
export function sd3NarcissismScoreFromUserRow(row: Record<string, unknown>): number | null {
  const sd3 = coercePsychometricScore(row.psychometrics_sd3_narcissism_score);
  if (sd3 != null) return sd3;
  return coercePsychometricScore(row.psychometrics_narq_s_score);
}

/** Automatic fail floors — SD3 column only (NARQ-S legacy columns must not trigger floors). */
export function sd3NarcissismScoreForFloorFromUserRow(row: Record<string, unknown>): number | null {
  return coercePsychometricScore(row.psychometrics_sd3_narcissism_score);
}

/** Coerced psychometric means for instrument floor gating (RFQ + SD3 + GASP/Dweck/SCS-SF). */
export function userHasPsychometricScoresForScoring(row: Record<string, unknown>): boolean {
  const scores = psychometricFloorScoresFromUserRow(row);
  return Object.values(scores).some((v) => v != null && Number.isFinite(v));
}

export function npiEntitlementScoreFromUserRow(row: Record<string, unknown>): number | null {
  return coercePsychometricScore(row.psychometrics_npi_entitlement_score);
}

export function psychometricFloorScoresFromUserRow(
  row: Record<string, unknown>,
): PsychometricFloorUserScores {
  return {
    rfqScore: coercePsychometricScore(row.psychometrics_rfq_score),
    gaspScore: coercePsychometricScore(row.psychometrics_gasp_score),
    dweckScore: coercePsychometricScore(row.psychometrics_dweck_score),
    scsSfScore: coercePsychometricScore(row.psychometrics_scs_sf_score),
    sd3NarcissismScore: sd3NarcissismScoreForFloorFromUserRow(row),
    npiEntitlementScore: npiEntitlementScoreFromUserRow(row),
    brsScore: coercePsychometricScore(row.psychometrics_brs_score),
    anxietyTraitScore: coercePsychometricScore(row.psychometrics_anxiety_trait_score),
    aaq2Score: coercePsychometricScore(row.psychometrics_aaq2_score),
    rsesScore: coercePsychometricScore(row.psychometrics_rses_score),
    scsPublicScore: coercePsychometricScore(row.psychometrics_scs_public_score),
    scsPrivateScore: coercePsychometricScore(row.psychometrics_scs_private_score),
  };
}

export function isMissingUsersPsychometricsSexualCommunicationColumnError(error: {
  code?: string | number;
  message?: string;
  details?: string;
  hint?: string;
} | null): boolean {
  if (!error) return false;
  const msg = concatPostgrestError(error);
  if (
    (String(error.code) === 'PGRST204' || String(error.code) === '42703') &&
    msg.includes('psychometrics_sexual_communication')
  ) {
    return true;
  }
  return (
    msg.includes('psychometrics_sexual_communication') &&
    (msg.includes('does not exist') || msg.includes('schema cache'))
  );
}

export function isMissingUsersPsychometricsRfqColumnError(error: {
  code?: string | number;
  message?: string;
  details?: string;
  hint?: string;
} | null): boolean {
  if (!error) return false;
  const msg = concatPostgrestError(error);
  if (
    (String(error.code) === 'PGRST204' || String(error.code) === '42703') &&
    msg.includes('psychometrics_rfq')
  ) {
    return true;
  }
  return (
    msg.includes('psychometrics_rfq') &&
    (msg.includes('does not exist') || msg.includes('schema cache'))
  );
}

/** True when a users SELECT can retry with fewer psychometric columns. */
export function isRecoverableUsersPsychometricsColumnError(error: {
  code?: string | number;
  message?: string;
  details?: string;
  hint?: string;
} | null): boolean {
  if (!error) return false;
  const msg = concatPostgrestError(error);
  return (
    isMissingUsersPsychometricsSd3ColumnsError(error) ||
    isMissingUsersPsychometricsRfqColumnError(error) ||
    isMissingUsersPsychometricsSexualCommunicationColumnError(error) ||
    String(error.code) === 'PGRST204' ||
    String(error.code) === '42703' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

/** Uncertainty / gaming inputs — omits SD3 and RFQ until migrations are applied. */
export const USERS_PSYCHOMETRIC_UNCERTAINTY_SCORES_SELECT_BASE = `
  psychometric_straight_line_flags,
  psychometrics_gasp_score,
  psychometrics_aaq2_score,
  psychometrics_brs_score,
  psychometrics_rses_score,
  psychometrics_scs_sf_score,
  psychometrics_dweck_score
`.trim();

export function buildUsersPsychometricUncertaintyScoresSelect(options?: {
  includeSd3?: boolean;
  includeRfq?: boolean;
}): string {
  const parts = [USERS_PSYCHOMETRIC_UNCERTAINTY_SCORES_SELECT_BASE];
  if (options?.includeSd3) parts.push('psychometrics_sd3_narcissism_score');
  if (options?.includeRfq) parts.push('psychometrics_rfq_score');
  return parts.join(', ');
}

/** Full psychometric modifier row — NARQ-S columns when SD3 migration is not applied. */
export const PSYCHOMETRIC_USER_SELECT_WITHOUT_SD3 = `
  psychometrics_brs_score,
  psychometrics_brs_responses,
  psychometrics_scs_sf_score,
  psychometrics_scs_sf_responses,
  psychometrics_gasp_score,
  psychometrics_gasp_responses,
  psychometrics_dweck_score,
  psychometrics_dweck_responses,
  psychometrics_aaq2_score,
  psychometrics_rses_score,
  psychometrics_scs_public_score,
  psychometrics_scs_private_score,
  psychometrics_aaq2_responses,
  psychometrics_rses_responses,
  psychometrics_scs_public_responses,
  psychometrics_scs_private_responses,
  psychometrics_mspss_friends_score,
  psychometrics_mspss_family_score,
  psychometrics_mspss_responses,
  psychometrics_narq_s_score,
  psychometrics_narq_s_responses,
  psychometrics_rfq_score,
  psychometrics_rfq_responses,
  psychometrics_completed_at
`.trim();

export const PSYCHOMETRIC_USER_SELECT_WITH_SD3 = `${PSYCHOMETRIC_USER_SELECT_WITHOUT_SD3},
  psychometrics_sd3_narcissism_score,
  psychometrics_sd3_narcissism_responses`.trim();

/** Minimal user select for psychometric floor gating (score columns only). */
export const PSYCHOMETRIC_FLOOR_SCORES_USER_SELECT = [
  'psychometrics_rfq_score',
  'psychometrics_gasp_score',
  'psychometrics_dweck_score',
  'psychometrics_scs_sf_score',
  'psychometrics_sd3_narcissism_score',
  'psychometrics_npi_entitlement_score',
  'psychometrics_brs_score',
  'psychometrics_anxiety_trait_score',
  'psychometrics_aaq2_score',
  'psychometrics_rses_score',
  'psychometrics_scs_public_score',
  'psychometrics_scs_private_score',
  'psychometrics_completed_at',
].join(',');

export const PSYCHOMETRIC_FLOOR_SCORES_USER_SELECT_LEGACY_SD3 = [
  'psychometrics_rfq_score',
  'psychometrics_gasp_score',
  'psychometrics_dweck_score',
  'psychometrics_scs_sf_score',
  'psychometrics_brs_score',
  'psychometrics_anxiety_trait_score',
  'psychometrics_aaq2_score',
  'psychometrics_rses_score',
  'psychometrics_scs_public_score',
  'psychometrics_scs_private_score',
  'psychometrics_completed_at',
].join(',');
