import {
  keyEvidenceHasNonEmptyAssessedText,
  pillarScoresHaveNumericAssessment,
} from './interviewCompletionGate';
import { coerceScoreToFiniteNumber } from './probeEvidenceUtils';

/** Markers scored in Moment 4 personal slice (matches scoring prompt contract). */
export const MOMENT4_SCORE_MARKER_IDS = [
  'contempt_recognition',
  'contempt_expression',
  'commitment_threshold',
  'accountability',
  'mentalizing',
] as const;

/**
 * After {@link normalizeScoresByEvidence}, numeric-only output can be `{}` even when the model returned
 * explicit nulls and assessed keyEvidence (all scores dropped as “no evidence”). Restore explicit `null`
 * for each Moment 4 marker so persistence and {@link personalMomentBundleWasScored} see a full bundle.
 */
export function mergeMoment4PillarScoresAfterEvidenceNormalize(
  numericFiltered: Record<string, number>,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const id of MOMENT4_SCORE_MARKER_IDS) {
    out[id] = Object.prototype.hasOwnProperty.call(numericFiltered, id) ? numericFiltered[id]! : null;
  }
  return out;
}

/** When every marker is null and there is no real evidence — minimal row so persistence/gates see a full key shape. */
export const MOMENT4_BUNDLE_INCOMPLETE_EVIDENCE_LINE =
  'Moment 4 incomplete model output; null scores retained for persistence.';

/** Model returned a numeric pillar but no assessable quote (truncated JSON, lazy completion, etc.). */
export const MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE = 'Score recovered from model output.';

export type Moment4ScoringParseDebug = {
  rawModelResponse?: string;
  parsedSnapshot?: unknown;
};

/** Normalize `pillar_scores` / `key_evidence` and lift pillar scores from raw text when JSON used nulls but numbers appear later in the response. */
export function coerceMoment4ParsedModelRecord(parsed: unknown): {
  pillarScores: Record<string, unknown>;
  keyEvidence: Record<string, string>;
} {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { pillarScores: {}, keyEvidence: {} };
  }
  const o = parsed as Record<string, unknown>;
  const psRaw = o.pillarScores ?? o.pillar_scores;
  const pillarScores =
    psRaw != null && typeof psRaw === 'object' && !Array.isArray(psRaw)
      ? { ...(psRaw as Record<string, unknown>) }
      : {};
  const keRaw = o.keyEvidence ?? o.key_evidence;
  const keyEvidence: Record<string, string> = {};
  if (keRaw != null && typeof keRaw === 'object' && !Array.isArray(keRaw)) {
    for (const [k, v] of Object.entries(keRaw as Record<string, unknown>)) {
      keyEvidence[k] = typeof v === 'string' ? v : v == null ? '' : String(v);
    }
  }
  return { pillarScores, keyEvidence };
}

export function mergeSalvagedMoment4PillarScoresIntoParsed(
  rawModelText: string,
  pillarScores: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...(typeof pillarScores === 'object' && pillarScores && !Array.isArray(pillarScores) ? pillarScores : {}),
  };
  for (const id of MOMENT4_SCORE_MARKER_IDS) {
    if (coerceScoreToFiniteNumber(out[id]) !== undefined) continue;
    const re = new RegExp(`"${id}"\\s*:\\s*(\\d+(?:\\.\\d+)?)`, 'i');
    const m = rawModelText.match(re);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) out[id] = n;
    }
  }
  return out;
}

/**
 * Coerce pillar/keyEvidence shapes and merge regex-salvaged pillar numerics before {@link normalizeScoresByEvidence}.
 * Mutates `result` in place (Amoraea personal-moment scoring).
 */
export function applyMoment4PostParseCoercionAndSalvage(
  rawModelText: string,
  result: Record<string, unknown>,
): void {
  const coerced = coerceMoment4ParsedModelRecord(result);
  result.pillarScores = mergeSalvagedMoment4PillarScoresIntoParsed(rawModelText, coerced.pillarScores);
  result.keyEvidence = coerced.keyEvidence;
  if (result.pillarConfidence == null && result.pillar_confidence != null) {
    result.pillarConfidence = result.pillar_confidence;
  }
}

/** After numerics survive normalize: ensure each scored marker has non-empty evidence for aggregation/sanitize. */
export function fillMoment4KeyEvidenceWhenNumericScoreButMissingQuote(result: {
  pillarScores?: Record<string, number | null | undefined> | null;
  keyEvidence?: Record<string, string> | null;
}): void {
  const ps = result.pillarScores;
  if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return;
  const next: Record<string, string> = { ...(result.keyEvidence ?? {}) };
  for (const id of MOMENT4_SCORE_MARKER_IDS) {
    const v = ps[id];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const ev = next[id]?.trim();
    if (!ev) {
      next[id] = MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE;
    }
  }
  result.keyEvidence = next;
}

/**
 * When the model returns explicit nulls for every Moment 4 marker but omits keyEvidence entirely, gates and
 * DB persistence treat the bundle as unscored. Fill minimal non-empty evidence so completion and audit stay consistent.
 */
export function backfillMoment4KeyEvidenceIfScoresOtherwiseUnpersistable(
  result: {
    pillarScores?: Record<string, number | null | undefined> | null;
    keyEvidence?: Record<string, string> | null;
  },
  debug?: Moment4ScoringParseDebug,
): void {
  const ps = result.pillarScores;
  if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return;
  if (pillarScoresHaveNumericAssessment(ps)) return;
  if (keyEvidenceHasNonEmptyAssessedText(result.keyEvidence)) return;
  console.warn(
    '[M4 Rubric] bundle incomplete backfill triggered (no numeric pillar scores + no assessable keyEvidence)',
  );
  if (debug?.rawModelResponse != null) {
    console.warn('[M4 Rubric] raw model response (preview):', debug.rawModelResponse.slice(0, 500));
  }
  if (debug?.parsedSnapshot != null) {
    console.warn('[M4 Rubric] parsed attempt (preview):', JSON.stringify(debug.parsedSnapshot).slice(0, 500));
  }
  const next: Record<string, string> = { ...(result.keyEvidence ?? {}) };
  for (const id of MOMENT4_SCORE_MARKER_IDS) {
    if (!next[id]?.trim()) {
      next[id] = MOMENT4_BUNDLE_INCOMPLETE_EVIDENCE_LINE;
    }
  }
  result.keyEvidence = next;
}
