import {
  keyEvidenceHasNonEmptyAssessedText,
  pillarScoresHaveNumericAssessment,
} from './interviewCompletionGate';
import { MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE } from './moment4ScoringParse';
import {
  type Moment5ScoringGuardContext,
  moment5HasAssessableUserResponse,
} from './moment5ScoringGuard';
import {
  combineMoment5UserTurnText,
  readTranscriptTurnInterviewMoment,
} from './moment5TranscriptHelpers';
import { normalizeResponseConcreteness, normalizeMoment4Concreteness } from './personalMomentConcreteness';
import {
  extractConstructEvidenceSnippet,
  formatConstructEvidenceQuote,
} from './scenarioConstructEvidenceExtraction';
import { mergeSalvagedScenarioKeyEvidenceFromRaw } from './scenarioScoringParse';
import {
  SKIPPED_BY_USER_FRUSTRATION_EVIDENCE,
  coerceScoreToFiniteNumber,
  evidenceAbsentForResponseDepthModifier,
  isPillarConfidenceOnlyEvidence,
  migratePillarConfidenceLeakedIntoKeyEvidence,
} from './probeEvidenceUtils';
import type { PersonalMoment5SliceForSanitize } from './personalMomentSliceSanitize';

export const MOMENT5_SCORE_MARKER_IDS = [
  'accountability',
  'mentalizing',
  'repair',
  'regulation',
  'contempt_expression',
] as const;

/**
 * After {@link normalizeScoresByEvidence}, Moment 5 can become `{}` when every marker was dropped.
 * Restore explicit `null` for each scored marker so {@link personalMomentBundleWasScored} and persistence
 * match the Moment 4 merge pattern.
 */
export function mergeMoment5PillarScoresAfterEvidenceNormalize(
  numericFiltered: Record<string, number>,
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const id of MOMENT5_SCORE_MARKER_IDS) {
    out[id] = Object.prototype.hasOwnProperty.call(numericFiltered, id) ? numericFiltered[id]! : null;
  }
  return out;
}

/** When every marker is null and there is no real evidence — minimal row so persistence sees a full key shape. */
export const MOMENT5_BUNDLE_INCOMPLETE_EVIDENCE_LINE =
  'Moment 5 incomplete model output; null scores retained for persistence.';

/** Participant confirmed skip on the final conflict question — persist scored skip markers for rollup. */
export function buildMoment5UserSkippedScoresAggregate(): PersonalMoment5SliceForSanitize {
  const pillarScores: Record<string, number | null> = {};
  const keyEvidence: Record<string, string> = {};
  const pillarConfidence: Record<string, string> = {};
  for (const id of MOMENT5_SCORE_MARKER_IDS) {
    pillarScores[id] = null;
    keyEvidence[id] = SKIPPED_BY_USER_FRUSTRATION_EVIDENCE;
    pillarConfidence[id] = 'not_assessed';
  }
  return {
    pillarScores,
    keyEvidence,
    pillarConfidence,
    scoringMetadata: { skipped_by_user: true, skip_trigger: 'm5_skip_request_confirmed' },
  };
}

/** Model returned a numeric pillar but no assessable quote (truncated JSON, lazy completion, etc.). */
export const MOMENT5_SCORE_RECOVERED_EVIDENCE_LINE = MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE;

export type Moment5ScoringParseDebug = {
  rawModelResponse?: string;
  parsedSnapshot?: unknown;
  attemptId?: string;
};

export type { Moment5ScoringGuardContext } from './moment5ScoringGuard';

export function coerceMoment5ParsedModelRecord(parsed: unknown): {
  pillarScores: Record<string, unknown>;
  keyEvidence: Record<string, string>;
} {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { pillarScores: {}, keyEvidence: {} };
  }
  const o = parsed as Record<string, unknown>;
  const psRaw = o.pillarScores ?? o.pillar_scores;
  const pillarScores: Record<string, unknown> =
    psRaw != null && typeof psRaw === 'object' && !Array.isArray(psRaw)
      ? { ...(psRaw as Record<string, unknown>) }
      : {};
  // Truncated model JSON: parseJsonObjectFromModelText often returns the nested pillarScores
  // object as root (balanced before the cut mid-keyEvidence string). Lift flat marker numbers.
  if (Object.keys(pillarScores).length === 0) {
    const looksLikeFlatScores =
      o.momentNumber == null &&
      o.momentName == null &&
      MOMENT5_SCORE_MARKER_IDS.some((id) => coerceScoreToFiniteNumber(o[id]) !== undefined);
    if (looksLikeFlatScores) {
      for (const id of MOMENT5_SCORE_MARKER_IDS) {
        if (coerceScoreToFiniteNumber(o[id]) !== undefined) {
          pillarScores[id] = o[id];
        }
      }
    }
  }
  const keRaw = o.keyEvidence ?? o.key_evidence;
  const keyEvidence: Record<string, string> = {};
  if (keRaw != null && typeof keRaw === 'object' && !Array.isArray(keRaw)) {
    for (const [k, v] of Object.entries(keRaw as Record<string, unknown>)) {
      keyEvidence[k] = typeof v === 'string' ? v : v == null ? '' : String(v);
    }
  }
  return { pillarScores, keyEvidence };
}

export function mergeSalvagedMoment5PillarScoresIntoParsed(
  rawModelText: string,
  pillarScores: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...(typeof pillarScores === 'object' && pillarScores && !Array.isArray(pillarScores) ? pillarScores : {}),
  };
  for (const id of MOMENT5_SCORE_MARKER_IDS) {
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

/** Regex salvage for depth fields omitted when pillar scores are recovered from truncated JSON. */
export function salvagePersonalMomentDepthFieldsFromRawModelText(raw: string): {
  response_concreteness: ReturnType<typeof normalizeResponseConcreteness>;
  emotional_vocab_count: number | null;
  emotional_vocab_words: string[];
  user_slice_word_count: number | null;
} {
  const rcMatch = raw.match(/"response_concreteness"\s*:\s*"(absent|valid_non_applicable|low|moderate|high)"/i);
  const response_concreteness = rcMatch
    ? normalizeMoment4Concreteness(rcMatch[1]) ?? normalizeResponseConcreteness(rcMatch[1])
    : null;

  const evcMatch = raw.match(/"emotional_vocab_count"\s*:\s*(\d+)/i);
  const emotional_vocab_count =
    evcMatch && Number.isFinite(Number(evcMatch[1])) ? Number(evcMatch[1]) : null;

  const uswMatch = raw.match(/"user_slice_word_count"\s*:\s*(\d+)/i);
  const user_slice_word_count =
    uswMatch && Number.isFinite(Number(uswMatch[1])) ? Number(uswMatch[1]) : null;

  const wordsMatch = raw.match(/"emotional_vocab_words"\s*:\s*\[([\s\S]*?)\]/i);
  let emotional_vocab_words: string[] = [];
  if (wordsMatch?.[1]) {
    emotional_vocab_words = [...wordsMatch[1].matchAll(/"([^"\\]+)"/g)].map((m) => m[1]!.trim()).filter(Boolean);
  }

  return {
    response_concreteness,
    emotional_vocab_count,
    emotional_vocab_words,
    user_slice_word_count,
  };
}

export type Moment5ScoredVia = 'primary' | 'recovery';

function moment5KeyEvidenceLineIsAssessable(ev: string | null | undefined): boolean {
  const trimmed = (ev ?? '').trim();
  if (!trimmed) return false;
  if (trimmed === MOMENT5_SCORE_RECOVERED_EVIDENCE_LINE) return false;
  if (trimmed === MOMENT5_BUNDLE_INCOMPLETE_EVIDENCE_LINE) return false;
  return !evidenceAbsentForResponseDepthModifier(trimmed);
}

function moment5KeyEvidenceNeedsBackfill(ev: string | undefined): boolean {
  const trimmed = ev?.trim() ?? '';
  if (!trimmed) return true;
  if (isPillarConfidenceOnlyEvidence(trimmed)) return true;
  return moment5KeyEvidenceLineIsAssessable(trimmed) === false;
}

/** Combined M5 user text from scoring slice, then tagged transcript rows. */
export function moment5UserTextFromScoringGuard(guard?: Moment5ScoringGuardContext): string {
  const fromSlice = (guard?.scoringSlice ?? [])
    .filter((t) => t.role === 'user')
    .map((t) => (t.content ?? '').trim())
    .filter(Boolean)
    .join(' ');
  if (fromSlice.trim()) return fromSlice;
  return combineMoment5UserTurnText(guard?.transcript);
}

/**
 * Salvage per-marker keyEvidence from raw JSON and backfill construct-specific transcript quotes
 * before deciding primary vs recovery.
 */
export function prepareMoment5KeyEvidenceFromModelOutput(
  rawModelText: string | undefined,
  result: {
    pillarScores?: Record<string, number | null | undefined> | null;
    keyEvidence?: Record<string, string> | null;
    pillarConfidence?: Record<string, string> | null;
  },
  guard?: Moment5ScoringGuardContext,
): void {
  if (!moment5HasAssessableUserResponse(guard)) return;
  const next: Record<string, string> = { ...(result.keyEvidence ?? {}) };
  const pillarConfidence =
    result.pillarConfidence != null && typeof result.pillarConfidence === 'object'
      ? { ...(result.pillarConfidence as Record<string, string>) }
      : undefined;
  migratePillarConfidenceLeakedIntoKeyEvidence(next, pillarConfidence);
  if (pillarConfidence) {
    result.pillarConfidence = pillarConfidence;
  }
  if (rawModelText?.trim()) {
    Object.assign(
      next,
      mergeSalvagedScenarioKeyEvidenceFromRaw(rawModelText, MOMENT5_SCORE_MARKER_IDS, next),
    );
  }
  result.keyEvidence = next;
  fillMoment5KeyEvidenceWhenNumericScoreButMissingQuote(result, guard);
}

/**
 * True when every numeric M5 marker has substantive keyEvidence from the primary model parse.
 */
export function moment5PrimaryParseIsComplete(
  pillarScores: Record<string, number | null | undefined> | null | undefined,
  keyEvidence: Record<string, string> | null | undefined,
): boolean {
  if (!pillarScores || typeof pillarScores !== 'object' || Array.isArray(pillarScores)) return false;
  let hasAnyScore = false;
  for (const id of MOMENT5_SCORE_MARKER_IDS) {
    const num = coerceScoreToFiniteNumber(pillarScores[id]);
    if (num === undefined) continue;
    hasAnyScore = true;
    if (!moment5KeyEvidenceLineIsAssessable(keyEvidence?.[id])) return false;
  }
  return hasAnyScore;
}

/** Lift snake_case fields and normalize pillar/keyEvidence shapes (always run on model output). */
export function applyMoment5ParsedModelShapeCoercion(result: Record<string, unknown>): void {
  const coerced = coerceMoment5ParsedModelRecord(result);
  result.pillarScores = coerced.pillarScores;
  result.keyEvidence = coerced.keyEvidence;
  if (result.pillarConfidence == null && result.pillar_confidence != null) {
    result.pillarConfidence = result.pillar_confidence;
  }
}

/** Regex salvage for truncated JSON — recovery path only. */
export function applyMoment5RecoverySalvageFromRawModelText(
  rawModelText: string,
  result: Record<string, unknown>,
  guard?: Moment5ScoringGuardContext,
): void {
  if (!moment5HasAssessableUserResponse(guard)) return;
  result.pillarScores = mergeSalvagedMoment5PillarScoresIntoParsed(
    rawModelText,
    result.pillarScores as Record<string, unknown> | null | undefined,
  );
}

/**
 * Primary parse when complete; otherwise recovery salvage + recovered keyEvidence backfill.
 * Returns how the bundle was produced for `scoringMetadata.scoredVia`.
 */
export function finalizeMoment5ParsedModelScore(
  rawModelText: string,
  result: Record<string, unknown>,
  guard: Moment5ScoringGuardContext,
  debug?: Moment5ScoringParseDebug,
): Moment5ScoredVia {
  const attemptId = debug?.attemptId ?? 'unknown';
  applyMoment5ParsedModelShapeCoercion(result);
  prepareMoment5KeyEvidenceFromModelOutput(rawModelText, result, guard);
  const pillarScores = result.pillarScores as Record<string, number | null | undefined> | undefined;
  const keyEvidence = result.keyEvidence as Record<string, string> | undefined;

  if (moment5PrimaryParseIsComplete(pillarScores, keyEvidence)) {
    console.log(`[M5] Primary path for attempt ${attemptId}`);
    console.log(
      `[M5] User turns with interviewMoment=5: ${(guard.transcript ?? []).filter((t) => readTranscriptTurnInterviewMoment(t) === 5 && t.role === 'user').length}`,
    );
    return 'primary';
  }

  const recoveryReason = !moment5HasAssessableUserResponse(guard)
    ? 'no_assessable_user_response'
    : 'primary_parse_missing_assessable_keyEvidence';
  console.log(`[M5] RECOVERY path for attempt ${attemptId}`);
  console.log(`[M5] Reason: ${recoveryReason}`);
  if (guard.transcript) {
    const m5Turns = guard.transcript.filter(
      (t) => t.role === 'user' && readTranscriptTurnInterviewMoment(t) === 5,
    );
    console.log(`[M5] interviewMoment=5 turns found: ${m5Turns.length}`);
    console.log(`[M5] Turn contents:`, m5Turns.map((t) => (t.content ?? '').slice(0, 50)));
    const combined = m5Turns
      .map((t) => (t.content ?? '').trim())
      .filter(Boolean)
      .join(' ');
    console.log(
      `[M5] Combined text (${combined.split(/\s+/).filter(Boolean).length} words): ${combined.slice(0, 100)}`,
    );
  }
  if (debug?.rawModelResponse != null) {
    console.warn('[M5 Scoring] raw model response (preview):', debug.rawModelResponse.slice(0, 500));
  }
  if (debug?.parsedSnapshot != null) {
    console.warn('[M5 Scoring] parsed attempt (preview):', JSON.stringify(debug.parsedSnapshot).slice(0, 500));
  }

  applyMoment5RecoverySalvageFromRawModelText(rawModelText, result, guard);
  fillMoment5KeyEvidenceWhenNumericScoreButMissingQuote(
    result as { pillarScores?: Record<string, number | null | undefined>; keyEvidence?: Record<string, string> },
    guard,
  );
  backfillMoment5KeyEvidenceIfScoresOtherwiseUnpersistable(
    result as { pillarScores?: Record<string, number | null | undefined>; keyEvidence?: Record<string, string> },
    debug,
    guard,
  );
  return 'recovery';
}

export function stampMoment5ScoringMetadata(
  result: Record<string, unknown>,
  scoredVia: Moment5ScoredVia,
  clientMeta?: Record<string, unknown> | null,
): void {
  const existing =
    result.scoringMetadata != null &&
    typeof result.scoringMetadata === 'object' &&
    !Array.isArray(result.scoringMetadata)
      ? (result.scoringMetadata as Record<string, unknown>)
      : {};
  result.scoringMetadata = {
    ...existing,
    ...(clientMeta ?? {}),
    scoredVia,
  };
}

/** @deprecated Prefer {@link finalizeMoment5ParsedModelScore} for primary vs recovery routing. */
export function applyMoment5PostParseCoercionAndSalvage(
  rawModelText: string,
  result: Record<string, unknown>,
  guard?: Moment5ScoringGuardContext,
): void {
  if (!moment5HasAssessableUserResponse(guard)) return;
  applyMoment5ParsedModelShapeCoercion(result);
  applyMoment5RecoverySalvageFromRawModelText(rawModelText, result, guard);
}
/** Before normalize: ensure each scored marker has evidence so numerics are not dropped (recovery only). */
export function fillMoment5KeyEvidenceWhenNumericScoreButMissingQuote(
  result: {
    pillarScores?: Record<string, number | null | undefined> | null;
    keyEvidence?: Record<string, string> | null;
  },
  guard?: Moment5ScoringGuardContext,
): void {
  if (!moment5HasAssessableUserResponse(guard)) return;
  const ps = result.pillarScores;
  if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return;
  const m5UserText = moment5UserTextFromScoringGuard(guard);
  const next: Record<string, string> = { ...(result.keyEvidence ?? {}) };
  for (const id of MOMENT5_SCORE_MARKER_IDS) {
    const v = coerceScoreToFiniteNumber(ps[id]);
    if (v === undefined) continue;
    if (!moment5KeyEvidenceNeedsBackfill(next[id])) continue;
    const snippet = extractConstructEvidenceSnippet(m5UserText, id);
    next[id] = snippet
      ? formatConstructEvidenceQuote(snippet)
      : MOMENT5_SCORE_RECOVERED_EVIDENCE_LINE;
  }
  result.keyEvidence = next;
}

/**
 * When the model returns explicit nulls for every Moment 5 marker but omits keyEvidence entirely, gates and
 * DB persistence treat the bundle as unscored. Fill minimal non-empty evidence so completion and audit stay consistent.
 */
export function backfillMoment5KeyEvidenceIfScoresOtherwiseUnpersistable(
  result: {
    pillarScores?: Record<string, number | null | undefined> | null;
    keyEvidence?: Record<string, string> | null;
  },
  debug?: Moment5ScoringParseDebug,
  guard?: Moment5ScoringGuardContext,
): void {
  if (!moment5HasAssessableUserResponse(guard)) {
    if (debug?.attemptId) {
      console.warn(
        `${debug.attemptId}: M5 score recovery skipped — no user response in transcript`,
      );
    }
    return;
  }
  const ps = result.pillarScores;
  if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return;
  if (pillarScoresHaveNumericAssessment(ps)) return;
  if (keyEvidenceHasNonEmptyAssessedText(result.keyEvidence)) return;
  console.warn(
    '[M5 Rubric] bundle incomplete backfill triggered (no numeric pillar scores + no assessable keyEvidence)',
  );
  if (debug?.rawModelResponse != null) {
    console.warn('[M5 Rubric] raw model response (preview):', debug.rawModelResponse.slice(0, 500));
  }
  if (debug?.parsedSnapshot != null) {
    console.warn('[M5 Rubric] parsed attempt (preview):', JSON.stringify(debug.parsedSnapshot).slice(0, 500));
  }
  const next: Record<string, string> = { ...(result.keyEvidence ?? {}) };
  for (const id of MOMENT5_SCORE_MARKER_IDS) {
    if (!next[id]?.trim()) {
      next[id] = MOMENT5_BUNDLE_INCOMPLETE_EVIDENCE_LINE;
    }
  }
  result.keyEvidence = next;
}
