/** Bridge unmigrated DBs (NARQ-S columns) and migrated DBs (SD3 narcissism columns). */

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

export function sd3NarcissismResponsesFromUserRow(row: Record<string, unknown>): unknown {
  return row.psychometrics_sd3_narcissism_responses ?? row.psychometrics_narq_s_responses ?? null;
}

/**
 * SD3 narcissism mean for modifier / uncertainty — prefers SD3 column, falls back to legacy NARQ-S
 * when migration 20260628140000 is not applied (scores saved via psychometricsPersistence legacy path).
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

export function psychometricFloorScoresFromUserRow(row: Record<string, unknown>): {
  rfqScore: number | null;
  gaspScore: number | null;
  dweckScore: number | null;
  scsSfScore: number | null;
  sd3NarcissismScore: number | null;
} {
  return {
    rfqScore: coercePsychometricScore(row.psychometrics_rfq_score),
    gaspScore: coercePsychometricScore(row.psychometrics_gasp_score),
    dweckScore: coercePsychometricScore(row.psychometrics_dweck_score),
    scsSfScore: coercePsychometricScore(row.psychometrics_scs_sf_score),
    sd3NarcissismScore: sd3NarcissismScoreForFloorFromUserRow(row),
  };
}
