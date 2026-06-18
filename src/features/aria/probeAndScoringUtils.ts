import { looksLikeMoment4GrudgePrompt, looksLikeMoment4ThresholdQuestion } from './moment4ProbeLogic';
import {
  keyEvidenceHasNonEmptyAssessedText,
  pillarScoresHaveNumericAssessment,
} from './interviewCompletionGate';
import { normalizeResponseConcreteness, normalizeMoment4Concreteness } from './personalMomentConcreteness';

/** User-facing; when set in keyEvidence, participant skipped the remainder of this segment after a frustration offer. */
export const SKIPPED_BY_USER_FRUSTRATION_EVIDENCE =
  'Not scored — participant chose to skip the remaining prompt in this segment after a frustration signal.';

/** User-facing; when set in keyEvidence, the slice did not receive the prompt (session ended, audio, etc.). */
export const NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE =
  'Not assessed — session ended due to technical difficulties before this prompt was delivered.';

/**
 * True when the evidence line marks missing data from technical interruption, not a scored “0” performance.
 * Per-marker keyEvidence in scenario slices.
 */
export function isNotAssessedDueToTechnicalInterruption(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const t = text.trim().toLowerCase();
  if (t === NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE.trim().toLowerCase()) return true;
  return (
    /\bnot assessed\b/.test(t) &&
    (/\b(session ended|ended early)\b.*\btechnical\b/.test(t) ||
      /\btechnical (difficult|interruption|failure)\b/.test(t) ||
      /\bbefore this prompt (was )?delivered\b/.test(t) ||
      /\binterview (ended|terminated)\b.*\btechnical\b/.test(t))
  );
}

/**
 * True when programmatic response-depth −1 may apply for this marker: model/keyEvidence
 * indicates nothing substantive to score (empty, recovery line, insufficient-evidence phrasing, etc.).
 * Returns false for technical non-assessment and frustration skip so we do not stack penalties.
 */
export function evidenceAbsentForResponseDepthModifier(text: string | null | undefined): boolean {
  if (text == null || typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (isNotAssessedDueToTechnicalInterruption(trimmed)) return false;
  if (trimmed === SKIPPED_BY_USER_FRUSTRATION_EVIDENCE) return false;

  const lower = trimmed.toLowerCase();
  if (/score\s+recovered\s+from\s+model\s+output/i.test(trimmed)) return true;
  if (/score\s+present,\s+evidence\s+not\s+returned\s+by\s+model/i.test(trimmed)) return true;
  if (/moment\s+4\s+incomplete\s+model\s+output/i.test(trimmed)) return true;
  if (/rubric\s+excerpt\s+omitted\s+in\s+model\s+json/i.test(trimmed)) return true;
  if (/insufficient\s+evidence/.test(lower)) return true;
  if (/no\s+assessable\s+evidence/.test(lower)) return true;
  if (/response\s+too\s+brief\s+to\s+assess/.test(lower)) return true;
  if (/too\s+brief\s+to\s+assess/.test(lower)) return true;

  if (isNoEvidenceText(trimmed)) return true;
  return false;
}

export function isNoEvidenceText(text: string | null | undefined): boolean {
  if (!text) return false;
  if (text.trim() === SKIPPED_BY_USER_FRUSTRATION_EVIDENCE) return true;
  const t = text.trim().toLowerCase();
  return (
    /no\s+[a-z_ ]+\s+content\s+in\s+this\s+(scenario|moment|interview)/i.test(t) ||
    /not\s+directly\s+assessed/i.test(t) ||
    /insufficient\s+evidence/i.test(t) ||
    /no\s+evidence\s+(was\s+)?(available|observed|surfaced)/i.test(t) ||
    /no substantive engagement with (the )?grudge/i.test(t) ||
    /moment 4[:\s]+no substantive engagement/i.test(t) ||
    /deflection, avoidance, or absent signal/i.test(t) ||
    /appreciation (was )?not assessed from this moment/i.test(t) ||
    /not assessed from this moment.*appreciation/i.test(t) ||
    /limited (close[- ]relationship|lived) (experience|opportunity)/i.test(t) ||
    /\bnot scored\b.*\bskip\b.*\bfrustration\b/i.test(t) ||
    /rubric excerpt omitted in model json/i.test(t) ||
    /moment 4 incomplete model output/i.test(t) ||
    /score present, evidence not returned by model/i.test(t)
  );
}

/**
 * Models sometimes emit pillar scores as numeric strings; `normalizeScoresByEvidence` only kept `typeof number`,
 * which dropped every pillar and left Moment 4/5 bundles unpersistable (all null + empty keyEvidence).
 */
export function coerceScoreToFiniteNumber(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t === '' || /^null$/i.test(t)) return undefined;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Intentional fill before normalize — must not drop the paired numeric score. */
export function isIntentionallyRecoveredScoreEvidence(text: string | null | undefined): boolean {
  const t = text?.trim() ?? '';
  if (!t) return false;
  return (
    /score\s+recovered\s+from\s+model\s+output/i.test(t) ||
    /score\s+present,\s+evidence\s+not\s+returned\s+by\s+model/i.test(t)
  );
}

export function normalizeScoresByEvidence(
  scores: Record<string, unknown> | null | undefined,
  keyEvidence: Record<string, string> | null | undefined
): Record<string, number> {
  if (!scores) return {};
  const out: Record<string, number> = {};
  Object.entries(scores).forEach(([id, raw]) => {
    const num = coerceScoreToFiniteNumber(raw);
    if (num === undefined) return;
    const ev = keyEvidence?.[id];
    if (isNoEvidenceText(ev) && !isIntentionallyRecoveredScoreEvidence(ev)) return;
    out[id] = num;
  });
  return out;
}

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
  numericFiltered: Record<string, number>
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
 * Mutates `result` in place (Aria personal-moment scoring).
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
  numericFiltered: Record<string, number>
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

/** Model returned a numeric pillar but no assessable quote (truncated JSON, lazy completion, etc.). */
export const MOMENT5_SCORE_RECOVERED_EVIDENCE_LINE = MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE;

export type Moment5ScoringParseDebug = {
  rawModelResponse?: string;
  parsedSnapshot?: unknown;
};

export function coerceMoment5ParsedModelRecord(parsed: unknown): {
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

/**
 * Coerce pillar/keyEvidence shapes and merge regex-salvaged pillar numerics before {@link normalizeScoresByEvidence}.
 * Mutates `result` in place (Aria personal-moment scoring).
 */
export function applyMoment5PostParseCoercionAndSalvage(
  rawModelText: string,
  result: Record<string, unknown>,
): void {
  const coerced = coerceMoment5ParsedModelRecord(result);
  result.pillarScores = mergeSalvagedMoment5PillarScoresIntoParsed(rawModelText, coerced.pillarScores);
  result.keyEvidence = coerced.keyEvidence;
  if (result.pillarConfidence == null && result.pillar_confidence != null) {
    result.pillarConfidence = result.pillar_confidence;
  }
}

/** Before normalize: ensure each scored marker has evidence so numerics are not dropped. */
export function fillMoment5KeyEvidenceWhenNumericScoreButMissingQuote(result: {
  pillarScores?: Record<string, number | null | undefined> | null;
  keyEvidence?: Record<string, string> | null;
}): void {
  const ps = result.pillarScores;
  if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return;
  const next: Record<string, string> = { ...(result.keyEvidence ?? {}) };
  for (const id of MOMENT5_SCORE_MARKER_IDS) {
    const v = coerceScoreToFiniteNumber(ps[id]);
    if (v === undefined) continue;
    const ev = next[id]?.trim();
    if (!ev) {
      next[id] = MOMENT5_SCORE_RECOVERED_EVIDENCE_LINE;
    }
  }
  result.keyEvidence = next;
}

/** Coerce per-scenario model JSON (`pillar_scores`, `key_evidence`, etc.) before evidence normalization. */
export function coerceScenarioScoreParsedModelRecord(parsed: unknown): {
  pillarScores: Record<string, unknown>;
  keyEvidence: Record<string, string>;
  pillarConfidence: Record<string, unknown>;
} {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { pillarScores: {}, keyEvidence: {}, pillarConfidence: {} };
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
  const pcRaw = o.pillarConfidence ?? o.pillar_confidence;
  const pillarConfidence =
    pcRaw != null && typeof pcRaw === 'object' && !Array.isArray(pcRaw)
      ? { ...(pcRaw as Record<string, unknown>) }
      : {};
  return { pillarScores, keyEvidence, pillarConfidence };
}

/** Lift numeric pillar scores from truncated scenario JSON when the parsed object omitted them. */
export function mergeSalvagedScenarioPillarScoresIntoParsed(
  rawModelText: string,
  markerIds: readonly string[],
  pillarScores: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...(typeof pillarScores === 'object' && pillarScores && !Array.isArray(pillarScores) ? pillarScores : {}),
  };
  for (const id of markerIds) {
    if (coerceScoreToFiniteNumber(out[id]) !== undefined) continue;
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`["']?${escaped}["']?\\s*[:=]\\s*(-?\\d+(?:\\.\\d+)?)`, 'i');
    const m = rawModelText.match(re);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) out[id] = n;
    }
  }
  return out;
}

/** Regex salvage for keyEvidence strings omitted when JSON truncates after pillarScores. */
export function mergeSalvagedScenarioKeyEvidenceFromRaw(
  rawModelText: string,
  markerIds: readonly string[],
  keyEvidence: Record<string, string>,
): Record<string, string> {
  const out = { ...keyEvidence };
  for (const id of markerIds) {
    if (out[id]?.trim()) continue;
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`["']?${escaped}["']?\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`, 'i');
    const m = rawModelText.match(re);
    if (m?.[1]) {
      const unescaped = m[1].replace(/\\"/g, '"').trim();
      if (unescaped) out[id] = unescaped;
    }
  }
  return out;
}

/**
 * Before {@link normalizeScoresByEvidence}: ensure each numeric marker has assessable evidence.
 * Prefer transcript excerpt over the generic recovery line when the model omitted keyEvidence.
 */
export function fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote(
  markerIds: readonly string[],
  result: {
    pillarScores?: Record<string, number | null | undefined> | null;
    keyEvidence?: Record<string, string> | null;
  },
  scenarioUserText: string,
): void {
  const ps = result.pillarScores;
  if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return;
  const excerpt = (scenarioUserText ?? '').trim();
  const quote =
    excerpt.length > 0
      ? `User (scenario slice): "${excerpt.length > 240 ? `${excerpt.slice(0, 240)}…` : excerpt}"`
      : '';
  const next: Record<string, string> = { ...(result.keyEvidence ?? {}) };
  for (const id of markerIds) {
    if (coerceScoreToFiniteNumber(ps[id]) === undefined) continue;
    const ev = next[id]?.trim();
    if (ev && !isNoEvidenceText(ev)) continue;
    next[id] = quote || MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE;
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
): void {
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

/** Named fixtures for tests — must NOT count as a temporally specific moment (habitual / values-only). */
export const MOMENT5_SPECIFIC_MOMENT_NEGATIVE_EXAMPLES = [
  "I try to acknowledge when people I care about do something significant, I'll send a message or take them out for a meal.",
  'I usually get people gifts for big occasions — birthdays, promotions, graduations',
  "I think it's important to let people know you're proud of them",
] as const;

/** Named fixtures — must count as a specific occasion / anchored narrative. */
export const MOMENT5_SPECIFIC_MOMENT_POSITIVE_EXAMPLES = [
  'I threw my friend a birthday party when she turned 30',
  'I flew in as a surprise when she defended her dissertation',
  'I wrote my partner a letter after they got the promotion',
] as const;

/**
 * True when the answer anchors to a particular occasion or past narrative — not habitual present-tense pattern.
 * Generic "I try to / I usually / I'll…" and values-only lines must return false.
 */
export function hasMoment5TemporallySpecificMoment(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  const lower = t.toLowerCase();

  if (
    /\b(i try to|i usually|i always|i'?ll often|i tend to|i make sure to|when people i care about do something|for big occasions)\b/.test(
      lower
    )
  ) {
    return false;
  }
  if (/\bi think it'?s important\b/.test(lower)) {
    const hasTemporalAnchor =
      /\b(when|after|threw|flew|wrote|party|turned|graduated|promotion|yesterday|last week|years ago|that time)\b/i.test(t);
    if (!hasTemporalAnchor) return false;
  }

  if (
    /\b(i (threw|flew|wrote|organized|planned|hosted|surprised)|we (threw|hosted|celebrated)|she (opened|cried)|he (opened|read))\b/i.test(
      lower
    )
  ) {
    return true;
  }
  if (
    /\b(when she (turned|graduated|defended)|when he (got|turned)|after (his|her|their) (promotion|birthday)|on (her|his|their) \d{1,2}(st|nd|rd|th)?\b|defended her dissertation|birthday party|after they got the promotion)\b/i.test(
      lower
    )
  ) {
    return true;
  }
  if (/\b(years ago|that time|one time|last (year|month|week)|yesterday)\b/.test(lower)) {
    return true;
  }
  if (/\b(my (friend|partner|wife|husband|mom|dad|mother|father))\b/i.test(lower)) {
    if (/\b(when|after|threw|wrote|flew|surprise|party|letter|turned)\b/i.test(t)) return true;
  }

  return false;
}

export function evaluateMoment5AppreciationSpecificity(text: string): {
  hasSpecificPerson: boolean;
  hasSpecificMoment: boolean;
  hasAttunement: boolean;
  hasRelationalSpecificity: boolean;
  isGeneric: boolean;
} {
  const t = text.toLowerCase().trim();
  if (!t || t.length < 12) {
    return {
      hasSpecificPerson: false,
      hasSpecificMoment: false,
      hasAttunement: false,
      hasRelationalSpecificity: false,
      isGeneric: true,
    };
  }
  const hasSpecificPerson =
    /\b(my|our)\s+(partner|wife|husband|boyfriend|girlfriend|friend|mom|mother|dad|father|sister|brother|cousin|aunt|uncle|daughter|son|teammate|roommate)\b|\b(he|she|they)\b/.test(
      t
    );
  const hasSpecificMoment = hasMoment5TemporallySpecificMoment(text);
  const hasAttunement =
    /\bneeded|was going through|felt|feeling|stressed|upset|overwhelmed|encourag|support|noticed|because they|hard year|hard time\b/.test(
      t
    );
  const hasConnectionMoment =
    /\b(in that moment|when (she|he|they) (opened it|saw it|heard it|responded)|we hugged|teared up|started crying|smiled and|it landed|really touched)\b/.test(
      t
    );
  const hasWordsExchanged =
    /"(.*?)"|\b(she said|he said|they said|i said|i told (her|him|them)|they told me)\b/.test(
      t
    );
  const hasMeaningDetail =
    /\b(meaningful|mattered|why it mattered|what made it meaningful|because (she|he|they) (had|were|was)|for (her|him|them) specifically)\b/.test(
      t
    );
  const hasRelationalSpecificity = hasConnectionMoment || hasWordsExchanged || hasMeaningDetail;
  const isGeneric = !(hasSpecificPerson && hasSpecificMoment && hasAttunement && hasRelationalSpecificity);
  return {
    hasSpecificPerson,
    hasSpecificMoment,
    hasAttunement,
    hasRelationalSpecificity,
    isGeneric,
  };
}

/** Client-injected Moment 5 (follows Moment 4 threshold answer). */
export const MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT =
  'Think of a time when you had a conflict with someone important to you. What happened, and how did things get resolved between you two?';

export const MOMENT_5_ACCOUNTABILITY_PROBE_TEXT =
  'What do you think you did or said that contributed to the conflict?';

/** Client-only — when the example may not contain a genuine conflict before accountability scoring. */
export const MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT =
  'Was there a point where it actually got tense between you two, or did it resolve pretty smoothly?';

/**
 * Moment 5 scripted accountability follow-up with a brief warmth beat before the question.
 * Used whenever the client injects this probe (not only bereavement): first-person conflict narratives
 * are inherently vulnerable; leading with appreciation avoids sounding cold before accountability.
 */
export const MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT =
  'I appreciate you getting vulnerable with me. What do you think you did or said that contributed to the conflict?';

/** Softer probe when the user gave philosophy/process framing without a specific conflict narrative. */
export const MOMENT_5_ACCOUNTABILITY_PROBE_PHILOSOPHY_TEXT =
  'That makes sense as a general approach. Can you think of a specific time you had a conflict with someone important to you — and what do you think you did or said that contributed to it?';

export const MOMENT_5_ACCOUNTABILITY_PROBE_PHILOSOPHY_WITH_GRIEF_ACK_TEXT =
  'I appreciate you getting vulnerable with me. That makes sense as a general approach. Can you think of a specific time you had a conflict with someone important to you — and what do you think you did or said that contributed to it?';

const STRONG_ACCOUNTABILITY_MARKERS = [
  'my part',
  'i was',
  'i did',
  'i said',
  'i should have',
  'i could have',
  "i wasn't",
  "i didn't",
  'my mistake',
  'my fault',
  'i contributed',
  'i take responsibility',
  'i own',
  "that's on me",
  'i tend to',
  'i have a pattern',
  'i realize i',
  'i realise i',
  'i acknowledge',
] as const;

/** Strong accountability via "I need to …" — excludes emotional-vent phrasing (Deb-style dump/hear). */
function moment5StrongNeedToAccountability(lower: string): boolean {
  if (/\bi\s+need\s+to\s+(dump|vent|express\s+my\s+feelings|share\s+my\s+feelings|be\s+heard|hear\s+them)\b/i.test(lower)) {
    return false;
  }
  return /\bi\s+need\s+to\s+(own|work\s+on|take|apologize|apologise|change|improve|do\s+better|communicate|listen)\b/i.test(
    lower
  );
}

function moment5HasStrongAccountabilityMarker(text: string): boolean {
  const lower = (text ?? '').trim().toLowerCase();
  if (moment5StrongNeedToAccountability(lower)) return true;
  return STRONG_ACCOUNTABILITY_MARKERS.some((marker) => lower.includes(marker));
}

/** Moderate self-ref that suggests engagement with one's role in a conflict episode (not generic philosophy). */
function moment5ModerateSelfRefSkipsProbe(text: string): boolean {
  if (!moment5ConflictEpisodeContext(text)) return false;
  const lower = (text ?? '').trim().toLowerCase();
  return (
    /\bi\s+felt\s+(hurt|upset|angry|triggered|defensive|dismissed)\b/i.test(lower) ||
    /\bi\s+feel\s+like\s+i\s+was\b/i.test(lower) ||
    /\bi\s+was\s+too\s+harsh\s+in\s+the\s+argument\b/i.test(lower)
  );
}

const MODERATE_SELF_REFERENCE_MARKERS = ['i feel', 'i think', 'i need', 'for me', "i've", "i'm"] as const;

const CONFLICT_CONTEXT_MARKERS = [
  'conflict',
  'argument',
  'fight',
  'disagreement',
  'tension',
  'upset',
  'hurt',
  'wrong',
  'apologize',
  'apologise',
  'sorry',
  'mistake',
] as const;

export type Moment5AccountabilityProbeSignalAnalysis = {
  hasStrongAccountability: boolean;
  hasModerateSelfRef: boolean;
  /** Keyword-level conflict mention (e.g. "I've had conflicts before"). */
  hasConflictKeyword: boolean;
  /** First-person engagement inside a described conflict episode — not abstract conflict talk alone. */
  hasConflictEpisodeContext: boolean;
  hasNarrative: boolean;
};

/** Conflict language tied to a described episode, not merely abstract mention of "conflicts". */
export function moment5ConflictEpisodeContext(text: string): boolean {
  const lower = (text ?? '').trim().toLowerCase();
  const hasConflictKeyword = CONFLICT_CONTEXT_MARKERS.some((marker) => lower.includes(marker));
  if (!hasConflictKeyword) return false;
  return (
    /\bi\s+had\s+a\s+conflict\b/i.test(lower) ||
    /\bwe\s+(argued|fought|had\s+a\s+(fight|argument|disagreement))\b/i.test(lower) ||
    /\b(i|we)\s+felt\s+(hurt|upset|angry|triggered|defensive|dismissed)\b/i.test(lower) ||
    /\b(i|we)\s+(yelled|apologized|apologised|walked\s+away|shut\s+down|overreacted|escalated)\b/i.test(lower) ||
    /\bi\s+told\s+(him|her|them)\b/i.test(lower) ||
    /\bi\s+was\s+too\s+harsh\s+in\s+the\s+argument\b/i.test(lower)
  );
}

export function analyzeMoment5AccountabilityProbeSignals(responseText: string): Moment5AccountabilityProbeSignalAnalysis {
  const text = (responseText ?? '').trim().toLowerCase();
  const hasStrongAccountability = moment5HasStrongAccountabilityMarker(responseText);
  const hasModerateSelfRef = MODERATE_SELF_REFERENCE_MARKERS.some((marker) => text.includes(marker));
  const hasConflictKeyword = CONFLICT_CONTEXT_MARKERS.some((marker) => text.includes(marker));
  const hasConflictEpisodeContext = moment5ConflictEpisodeContext(responseText);
  const hasNarrative = moment5PersonalNarrativeHasConcreteAnchor(responseText);
  return {
    hasStrongAccountability,
    hasModerateSelfRef,
    hasConflictKeyword,
    hasConflictEpisodeContext,
    hasNarrative,
  };
}

/**
 * Fire when the answer lacks explicit self-accountability — not gated on having a conflict narrative first.
 */
export function shouldFireAccountabilityProbe(responseText: string): boolean {
  if (!responseText || responseText.trim().length === 0) return true;

  if (moment5AnswerHasExplicitSelfAccountability(responseText)) {
    console.log('[AccountabilityProbe] explicit self-accountability — not probing');
    return false;
  }

  const selfRef = evaluateMoment5AccountabilitySelfReference(responseText);
  if (
    selfRef.self_reference_type === 'boundary_expression' ||
    selfRef.self_reference_type === 'specific_ownership'
  ) {
    console.log('[AccountabilityProbe] self-reference type — not probing', selfRef.self_reference_type);
    return false;
  }

  const { hasStrongAccountability, hasModerateSelfRef, hasConflictEpisodeContext } =
    analyzeMoment5AccountabilityProbeSignals(responseText);

  if (hasStrongAccountability) {
    console.log('[AccountabilityProbe] strong accountability detected — not probing');
    return false;
  }

  if (hasModerateSelfRef && hasConflictEpisodeContext && moment5ModerateSelfRefSkipsProbe(responseText)) {
    console.log('[AccountabilityProbe] moderate self-ref with conflict episode engagement — not probing');
    return false;
  }

  console.log('[AccountabilityProbe] no accountability signal found — probing', {
    hasModerateSelfRef,
    hasConflictEpisodeContext,
  });
  return true;
}

export function pickMoment5AccountabilityProbeSpokenText(
  responseText: string,
  opts?: { griefAckPrefix?: boolean }
): string {
  const { hasModerateSelfRef, hasConflictEpisodeContext } = analyzeMoment5AccountabilityProbeSignals(responseText);
  const philosophyStyle = hasModerateSelfRef && !hasConflictEpisodeContext;
  if (opts?.griefAckPrefix) {
    return philosophyStyle
      ? MOMENT_5_ACCOUNTABILITY_PROBE_PHILOSOPHY_WITH_GRIEF_ACK_TEXT
      : MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT;
  }
  return philosophyStyle ? MOMENT_5_ACCOUNTABILITY_PROBE_PHILOSOPHY_TEXT : MOMENT_5_ACCOUNTABILITY_PROBE_TEXT;
}

/** Client-only — concrete anchor before accountability when the first answer is generic/process-only. */
export const MOMENT_5_SPECIFICITY_REDIRECT_TEXT =
  'Can you think of a specific time — maybe with a partner, friend, or family member — and walk me through what happened?';

/** Alternate client-only redirect (detection only). */
export const MOMENT_5_SPECIFICITY_REDIRECT_ALT_TEXT =
  'Is there a specific person or situation that comes to mind when you think about conflict?';

/** After redirect, user still abstract — offer to move on (no accountability probe). */
export const MOMENT_5_PERSISTENT_ABSTRACT_MOVE_ON_TEXT =
  "That's okay — we don't need to force a specific story. Whenever you're ready, we can wrap up.";

/** Client-injected when the first Moment 5 answer describes the conflict but not how it resolved. */
export const MOMENT_5_RESOLUTION_FOLLOWUP_TEXT = 'How did it get resolved between you two?';

export function looksLikeMoment5ResolutionFollowUpPrompt(text: string | null | undefined): boolean {
  const n = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!n) return false;
  if (n === MOMENT_5_RESOLUTION_FOLLOWUP_TEXT.toLowerCase()) return true;
  return (
    /\bhow\s+did\s+it\s+get\s+resolved\b/i.test(n) &&
    /\b(between\s+you\s+two|the\s+two\s+of\s+you|between\s+you)\b/i.test(n)
  );
}

export function transcriptHasMoment5ResolutionFollowUpAsked(
  transcript: readonly { role?: string; content?: string | null; isWelcomeBack?: boolean }[] | null | undefined,
): boolean {
  if (!Array.isArray(transcript)) return false;
  return transcript.some(
    (m) =>
      m.role === 'assistant' &&
      !m.isWelcomeBack &&
      looksLikeMoment5ResolutionFollowUpPrompt(m.content ?? ''),
  );
}

/** Named person-like token (not sentence-initial function words); conservative — mirrors M4 grudge anchor. */
const MOMENT5_LIKELY_PROPER_NAME_RE =
  /\b(?!I\b|A\b|The\b|We\b|It\b|So\b|If\b|My\b|In\b|At\b|On\b|He\b|She\b|They\b|That\b|This\b|And\b|But\b)[A-Z][a-z]{2,}\b/;

/** True when assistant turn is the scripted Moment 5 specificity redirect (before accountability probe). */
export function looksLikeMoment5SpecificityRedirectPrompt(text: string | null | undefined): boolean {
  const n = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!n) return false;
  /** Canonical client inject + common model paraphrases */
  const canonical =
    (n.includes('can you think of a specific time') || n.includes('could you think of a specific time')) &&
    (n.includes('walk me through') || n.includes('walk me thru'));
  const relaxed =
    (n.includes('specific time') && (n.includes('walk me through') || n.includes('walk me thru'))) ||
    (n.includes('specific person') && n.includes('comes to mind') && n.includes('conflict'));
  /** Philosophy-style accountability probe that embeds a specificity ask — treat as redirect phase for gating. */
  const philosophySpecificityAsk =
    (n.includes('general approach') || n.includes('makes sense as a general')) &&
    (n.includes('specific time') || n.includes('specific person')) &&
    n.includes('conflict');
  return canonical || relaxed || philosophySpecificityAsk;
}

/**
 * When the client already delivered {@link MOMENT_5_SPECIFICITY_REDIRECT_TEXT}, remove a duplicate ask that the
 * model glued into the same paragraph (post-processing only sees one `\\n\\n` block).
 */
export function stripEmbeddedMoment5SpecificityRedirectAsk(draft: string): string {
  const t0 = (draft ?? '').trim();
  if (!t0) return draft;
  /** Do not use {@link looksLikeMoment5SpecificityRedirectPrompt} on the full draft — it matches any paragraph that merely *contains* the scripted ask. */
  const normalized = normalizeInterviewTypography(t0);
  let t = normalized;
  const re = /\b(?:can|could)\s+you\s+think\s+of\s+a\s+specific\s+time\b[\s\S]{0,420}?\?/gi;
  let prev = '';
  while (prev !== t) {
    prev = t;
    t = t.replace(re, '').replace(/\s{2,}/g, ' ').trim();
  }
  return t
    .replace(/^\s*[.,;—–\-–]\s*/g, '')
    .replace(/\s+[.,;—–\-–]\s*$/g, '')
    .trim();
}

/**
 * Parallel streaming TTS flushes by sentence before {@link stripDuplicateMoment5SpecificityRedirectParagraphs}
 * runs on the full assistant turn. When the client already spoke {@link MOMENT_5_SPECIFICITY_REDIRECT_TEXT},
 * suppress model echoes of that line in a flushed chunk.
 *
 * @returns `null` when the whole flushed sentence should be skipped for TTS; otherwise the text to speak
 * (may be a suffix after stripping a glued-in redirect that shared a sentence with an accountability ask).
 */
export function stripMoment5SpecificityRedirectStreamingEcho(
  spoken: string,
  redirectAlreadyInjected: boolean,
): string | null {
  const t0 = normalizeInterviewTypography((spoken ?? '').trim());
  if (!redirectAlreadyInjected || !t0) {
    return t0;
  }
  if (!looksLikeMoment5SpecificityRedirectPrompt(t0)) {
    return t0;
  }
  const low = t0.toLowerCase();
  const accountabilityTail =
    /\bwhat do you think you did or said that contributed\b/.test(low) ||
    /\bwhat was your part\b/.test(low) ||
    /\bwhat part did you play\b/.test(low) ||
    /\byour part in how\b/.test(low) ||
    /\bcontributed to the conflict\b/.test(low);
  if (accountabilityTail) {
    const wmiThrough = low.indexOf('walk me through');
    const wmiThru = low.indexOf('walk me thru');
    const wmi = wmiThrough >= 0 ? wmiThrough : wmiThru;
    if (wmi < 0) {
      return t0;
    }
    const cut = t0.indexOf('?', wmi);
    if (cut < 0) {
      return t0;
    }
    const remainder = t0.slice(cut + 1).trim().replace(/^[.\s—–-]+/, '');
    return remainder.length > 0 ? remainder : null;
  }
  return null;
}

export function looksLikeMoment5ConflictValidityClarificationPrompt(text: string | null | undefined): boolean {
  const n = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!n) return false;
  /** Client-injected canonical copy */
  if (n.includes('actually got tense between you two') || n.includes('resolve pretty smoothly')) return true;
  /**
   * Models often paraphrase (drop "actually"/"pretty", reorder) — still the same construct so we must
   * dedupe TTS/transcript and avoid stacking a second client inject on top of a model-delivered ask.
   */
  const mentionsTenseBetweenYouTwo =
    /\b(between\s+you\s+two|the\s+two\s+of\s+you)\b/.test(n) && /\b(tense|tension|got\s+tense)\b/.test(n);
  const mentionsResolveSmooth =
    /\bresolve[d]?\b/.test(n) && /\b(smoothly|smooth)\b/.test(n);
  const pointOrEitherBranch =
    /\bwas\s+there\s+a\s+point\b/.test(n) ||
    /\bdid\s+it\s+resolve\b/.test(n) ||
    /\bor\s+did\b.*\bresolve\b/i.test(n) ||
    /\bwas\s+it\s+tense\b/i.test(n);
  return mentionsTenseBetweenYouTwo && mentionsResolveSmooth && pointOrEitherBranch;
}

export function moment5ResponseAddsTensionDetail(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return false;
  return /\b(argument|fight|disagreement|tension|tense|rupture|strained|strain|upset|hurt|angry|frustrated|resent|blew up|yelled|raised (my|their|our) voice|stopped talking|silent treatment|walked out|cried|crying|defensive|apologiz|repair|make amends)\b/i.test(
    t
  );
}

export type ConflictValidityResult = 'no_conflict' | 'resolved_well' | 'genuine_conflict';

export const M5_NO_CONFLICT_SIGNAL_PHRASES = [
  'no it was fine',
  'nothing got tense',
  'it was never really tense',
  'pretty smooth',
  'resolved smoothly',
  'not really tense',
  'no tension',
  'it was actually smooth',
  'honestly pretty smooth',
  'not much tension',
  'it stayed calm',
  'it was fine',
  'ended fine',
  'resolved fine',
  'worked it out',
  'made up',
  'moved on',
  'not a big deal',
  'calmed down',
  'sorted it out',
  'figured it out',
] as const;

export const M5_RESOLVED_WELL_SIGNAL_PHRASES = [
  'it did get tense',
  'there was tension',
  'it was tense for a bit',
  'it was tense',
  'yeah it got heated',
  'things got a bit tense',
  'it was uncomfortable',
  'there was a moment',
  'we had words',
  'it escalated briefly',
  'feelings were hurt',
  'there was some tension',
] as const;

const PRIOR_M5_TENSION_PATTERN_SOURCE =
  'apologize|disrespect|upset|hurt|conflict|argument|tense|heated|altercation|altercations|fight|yell|yelled|yelling|shouted|shouting|angry|anger|frustrated|frustration|disagreement|confrontation|blowup|blow\\s*up';

/** Prior M5 narrative cues that disambiguate smooth clarification answers toward resolved_well. */
export const PRIOR_M5_TENSION_SIGNAL_PATTERN = new RegExp(PRIOR_M5_TENSION_PATTERN_SOURCE, 'i');

export function priorM5TranscriptHadTension(priorM5Transcript: string): boolean {
  return PRIOR_M5_TENSION_SIGNAL_PATTERN.test(priorM5Transcript);
}

function priorM5TensionTokenMatches(priorM5Transcript: string): string[] {
  const matches: string[] = [];
  for (const m of priorM5Transcript.toLowerCase().matchAll(new RegExp(PRIOR_M5_TENSION_PATTERN_SOURCE, 'gi'))) {
    const token = m[0]?.trim();
    if (token && !matches.includes(token)) matches.push(token);
  }
  return matches;
}

export type ConflictValidityClassificationDebug = {
  result: ConflictValidityResult;
  clarificationResponse: string;
  hasNoConflict: boolean;
  hasResolvedWell: boolean;
  priorHadTension: boolean;
  matchedNoConflictPhrases: string[];
  matchedResolvedWellPhrases: string[];
  priorTensionMatches: string[];
};

export function analyzeConflictValidityClassification(
  clarificationResponse: string,
  priorM5Transcript: string,
): ConflictValidityClassificationDebug {
  const text = clarificationResponse.toLowerCase();
  const matchedNoConflictPhrases = M5_NO_CONFLICT_SIGNAL_PHRASES.filter((s) => text.includes(s));
  const matchedResolvedWellPhrases = M5_RESOLVED_WELL_SIGNAL_PHRASES.filter((s) => text.includes(s));
  const priorTensionMatches = priorM5TensionTokenMatches(priorM5Transcript);
  const hasNoConflict = matchedNoConflictPhrases.length > 0;
  const hasResolvedWell = matchedResolvedWellPhrases.length > 0;
  const priorHadTension = priorTensionMatches.length > 0;
  const result = classifyConflictValidity(clarificationResponse, priorM5Transcript);
  return {
    result,
    clarificationResponse,
    hasNoConflict,
    hasResolvedWell,
    priorHadTension,
    matchedNoConflictPhrases: [...matchedNoConflictPhrases],
    matchedResolvedWellPhrases: [...matchedResolvedWellPhrases],
    priorTensionMatches,
  };
}

/**
 * Classifies the user's answer to the conflict-validity clarification question.
 * Uses prior M5 narrative context to disambiguate smooth-resolution phrasing.
 */
export function classifyConflictValidity(
  clarificationResponse: string,
  priorM5Transcript: string,
): ConflictValidityResult {
  const text = clarificationResponse.toLowerCase();

  const hasNoConflict = M5_NO_CONFLICT_SIGNAL_PHRASES.some((s) => text.includes(s));
  const hasResolvedWell = M5_RESOLVED_WELL_SIGNAL_PHRASES.some((s) => text.includes(s));

  const priorHadTension = priorM5TranscriptHadTension(priorM5Transcript);

  if (hasResolvedWell) return 'resolved_well';
  if (hasNoConflict && !priorHadTension) return 'no_conflict';
  if (hasNoConflict && priorHadTension) return 'resolved_well';

  return 'genuine_conflict';
}

/** @deprecated Prefer {@link classifyConflictValidity} after the clarification question fires. */
export function moment5ConflictValidityIsLow(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim();
  if (t.length < 24) return false;
  const lower = t.toLowerCase();
  if (moment5ResponseAddsTensionDetail(t)) return false;

  const smoothOrLogistics =
    /\b(resolved pretty smoothly|pretty smooth|smoothly|no big deal|wasn'?t a big deal|not really a conflict|not much conflict|no real conflict|just talked it out|talked it out|we talked and it was fine)\b/i.test(
      lower
    ) ||
    /\b(boundary|boundaries|schedule|scheduling|logistics|plans?|calendar|chores|money|budget)\b/i.test(lower);

  const lowRuptureProcess =
    /\b(we|i)\s+(just\s+)?(talked|discussed|communicated|set|decided|agreed)\b/i.test(lower) &&
    !/\b(then|after that|eventually)\b.{0,80}\b(apologiz|repair|made up|resolved|came back|owned|took responsibility)\b/i.test(
      lower
    );

  return smoothOrLogistics || lowRuptureProcess;
}

/**
 * Moment 5 only: user disclosed death / bereavement (not merely breakup or estrangement).
 * Conservative on metaphors ("death of the relationship") and on "lost them" without bereavement cues.
 */
export function moment5ResponseContainsDeathDisclosure(userText: string): boolean {
  const raw = userText.replace(/\s+/g, ' ').trim();
  if (raw.length < 14) return false;
  const lower = raw.toLowerCase();

  const splitOrMetaphorBreakup =
    /\b(dead to me|dead to us|relationship (is |was )?dead to)\b/i.test(raw) ||
    /\bdeath of (the |our )?relationship\b/i.test(lower);
  if (splitOrMetaphorBreakup) {
    const personBereavement =
      /\b(passed away|passed on|funeral|burial|memorial service|deceased|suicide)\b/i.test(lower) ||
      /\bi lost my (dad|father|mom|mother|mum|parents|brother|sister|son|daughter|baby)\b/i.test(lower) ||
      /\b(my|our|his|her|their)\s+(dad|mom|mother|father|brother|sister|son|daughter|spouse|partner|wife|husband)\s+died\b/i.test(
        lower,
      ) ||
      (/\b(she|he|they)\s+died\b/i.test(lower) && !/\bnobody\s+died\b/i.test(lower));
    if (!personBereavement) return false;
  }

  const estrangementLost =
    /\blost (him|her|them)\b/i.test(lower) &&
    /\b(after|when|because)\b/i.test(lower) &&
    /\b(break up|broke up|cheat|cheating|left me|walked out|divorce|split up|ghosted|argument|fight)\b/i.test(lower) &&
    !/\b(died|passed away|passed on|death|funeral|deceased|suicide|burial|memorial)\b/i.test(lower);
  if (estrangementLost) return false;

  const deathLexicon =
    /\b(died|passed away|passed on|deceased|funeral|memorial service|burial|cremat|bereavement|bereaved|suicide|took (his|her|their) own life|lost (his|her|their) life|fatal|homicide|stillborn|miscarriage|in hospice)\b/i.test(
      lower,
    );
  const explicitDeath =
    deathLexicon ||
    /\bdeath of (my|our|his|her|their)\b/i.test(lower) ||
    /\b(my|our|his|her|their)\s+(dad|mom|mother|father|parent|brother|sister|son|daughter|spouse|partner|wife|husband)\s+(died|passed)\b/i.test(lower);

  const lostFamilyMember =
    /\bi lost (my )?(dad|father|mom|mother|mum|parents|brother|sister|son|daughter|child|children|baby|grandma|grandmother|grandpa|grandfather)\b/i.test(
      lower,
    );
  const lostPartnerOrFriendWithDeathCue =
    /\bi lost (my )?(husband|wife|spouse|partner|friend|gf|bf)\b/i.test(lower) && deathLexicon;
  const lostCloseRelative = lostFamilyMember || lostPartnerOrFriendWithDeathCue;

  const lostPronounWithBereavementCue =
    /\blost (him|her|them)\b/i.test(lower) &&
    /\b(died|passed away|passed on|death|funeral|burial|memorial|gone forever|taken (from us|too soon)|no longer (with us|here))\b/i.test(lower);

  const goneEuphemism =
    /\b(they'?re|they are|he'?s|she'?s|he is|she is) gone\b/i.test(lower) &&
    /\b(died|passed away|passed on|death|funeral|burial|memorial|lost (him|her|them))\b/i.test(lower);

  const capitalizedNameDied =
    /\b[A-Z][a-z]{1,24}\s+(died|passed away|passed on)\b/.test(raw);

  return explicitDeath || lostCloseRelative || lostPronounWithBereavementCue || goneEuphemism || capitalizedNameDied;
}

export type Moment5TranscriptTurn = {
  role?: string;
  content?: string | null;
  interviewMoment?: number;
};

/** All user turns tagged `interviewMoment: 5` in order — used for anchor/probe gates across follow-ups. */
export function combineMoment5UserTurnText(
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
): string {
  const parts: string[] = [];
  if (!Array.isArray(transcript)) return '';
  for (const t of transcript) {
    if (t.role !== 'user' || t.interviewMoment !== 5) continue;
    const c = (t.content ?? '').trim();
    if (c) parts.push(c);
  }
  return parts.join(' ');
}

/** Prior M5 user turns plus the in-flight reply — for cross-turn accountability/resolution gates. */
export function combineMoment5UserTextIncludingCurrent(
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
  currentUserText: string,
): string {
  const prior = combineMoment5UserTurnText(transcript);
  const current = currentUserText.replace(/\s+/g, ' ').trim();
  if (!prior) return current;
  if (!current) return prior;
  return `${prior} ${current}`;
}

/** M5 user narrative before the conflict-validity clarification answer (excludes clarification response). */
export function extractPriorM5TranscriptBeforeClarification(
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
): string {
  return combineMoment5UserTurnText(transcript);
}

/** True when any Moment 5 user turn (combined) already names a person/episode — not only the latest reply. */
export function moment5TranscriptHasConcreteAnchor(
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
): boolean {
  const combined = combineMoment5UserTurnText(transcript);
  if (!combined) return false;
  return moment5PersonalNarrativeHasConcreteAnchor(combined);
}

/** Pushback after a friend/partner redirect when the user already gave a concrete story earlier in M5. */
export function moment5UserDeclinesConcreteReask(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return false;
  return (
    /\bi\s+just\s+told\s+you\b/.test(t) ||
    /\bi\s+already\s+told\s+you\b/.test(t) ||
    /\bi\s+just\s+said\s+(that|so)\b/.test(t) ||
    /\bi\s+already\s+(said|answered)\s+(that|this)\b/.test(t) ||
    /\bdidn'?t\s+i\s+already\s+answer\b/.test(t) ||
    /\bi\s+think\s+i\s+covered\s+that\b/.test(t) ||
    /\b(not a general|wasn'?t a general|that was not a general|not\s+general\s+approach)\b/.test(t) ||
    /\b(named a specific|gave a specific|already named|specific person|specific example)\b/.test(t) ||
    /\bi\s+already\s+(named|gave|shared|described)\b/.test(t) ||
    /\bi\s+already\s+been\s+through\b/.test(t)
  );
}

/**
 * Short replay when the user asks to hear the question again in Moment 5 but already answered substantively.
 * Replays the immediate last interviewer question — not the full M4→5 bundle.
 */
export function buildMoment5ConfusionRepeatReplayAfterPriorAnswer(args: {
  lastInterviewerText: string;
}): string {
  const last = (args.lastInterviewerText ?? '').trim();
  if (last) {
    const questions = last.match(/[^.!?]*\?/g);
    const lastQuestion = questions?.[questions.length - 1]?.trim();
    if (lastQuestion && lastQuestion.length >= 12) {
      return `Got it — ${lastQuestion}`;
    }
  }
  if (
    isMoment5AssistantAnchor(last) ||
    transcriptAssistantContainsMoment5PrimaryConflictQuestion(last)
  ) {
    return `Got it — ${MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT}`;
  }
  return `Got it — ${MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT}`;
}

/**
 * Moment 5 only: true when the user anchored to a specific relationship/person and a particular episode,
 * not only generic conflict advice or first-person process habits.
 */
export function moment5PersonalNarrativeHasConcreteAnchor(userText: string): boolean {
  const raw = userText.replace(/\s+/g, ' ').trim();
  if (!raw || raw.length < 28) return false;
  const t = raw;
  const lower = t.toLowerCase();
  const wc = t.split(/\s+/).filter(Boolean).length;

  const instructionalYouHeavy =
    /\b(you should|you need to|you have to|when you have (a )?conflict|if you('re| are) (in|having))\b/i.test(lower) &&
    (t.match(/\byou\b/gi) ?? []).length >= 2 &&
    (t.match(/\bi\b/gi) ?? []).length <= 2 &&
    !/\b(my |me,|me |mine |i was |i had |with my |our )\b/i.test(lower);

  if (instructionalYouHeavy) return false;

  const genericProcessOnly =
    /^\s*(well |honestly |so |look, )?i (usually|often|always|typically|generally|just|try to|tend to)\s+(address|handle|discuss|talk|communicate|listen|find|navigate|mediate|work through|figure out)\b/i.test(
      lower,
    ) &&
    !/\b(she|he|they|we had|we got|my |our |friend|partner|boss|mom|dad)\b/i.test(lower) &&
    wc < 70;

  if (genericProcessOnly) return false;

  const namedPersonConflictAnchor =
    MOMENT5_LIKELY_PROPER_NAME_RE.test(t) &&
    /\b(called|said|told|texted|argued|fought|upset|angry|yelled|coach|conflict|disagreed|walked|criticized|judged|facilitator|resolved|perspectives|feedback|tense|hurt)\b/i.test(
      lower,
    );

  const relationalAnchor =
    namedPersonConflictAnchor ||
    /\b(my (mom|mum|dad|mother|father|parents|brother|sister|son|daughter|kids|child|children|husband|wife|partner|spouse|ex|boss|friend|friends|coworker|colleague|neighbor|roommate|gf|bf|aunt|uncle|cousin|niece|nephew|buddy|teammate|client|coach|landlord|tenant))\b/i.test(
      t,
    ) ||
    /\bmy\s+(mother|father|sister|brother)-in-law\b/i.test(lower) ||
    /\b(my|our)\s+(parents-in-law|in-laws)\b/i.test(lower) ||
    /\bmy\s+step(mother|father|dad|mom|brother|sister|sibling|kid|child)\b/i.test(lower) ||
    /\b(?:my\s+)?(?:fiance|fiancé|fiancée)\b/i.test(lower) ||
    /\b(a|my)\s+buddy\b/i.test(lower) ||
    /** "my best friend", "my late best friend" — not matched by `my friend` (word immediately after my). */
    /\bmy\s+(?:\w+\s+){0,3}friend\b/i.test(lower) ||
    /\b(best|close|childhood)\s+friend\b/i.test(lower) ||
    /\b(my|our|the|a)\s+(friend|partner|ex|boss|coworker|co-worker|colleague|neighbor|manager|teammate|flatmate)\b/i.test(lower) ||
    /\bsomeone(?:\s+i\s+(?:trusted|cared\s+about|knew(?:\s+well)?)|\s+who|\s+that|\s+important|\s+close(?:\s+to)?)\b/i.test(
      lower,
    ) ||
    /\b(a|the) (woman|man|person)\b/i.test(lower) ||
    /\b(i was dating|we were dating|my relationship|with my )\b/i.test(lower) ||
    /\b(the|this)\s+(guy|gal|woman|man)\s+i\s+(was\s+)?(seeing|dating|living\s+with)\b/i.test(lower);

  const dyadicOrEpisode =
    /\bwe ('?ve|had|got|were|argued|fought|disagreed|talked|made up|resolved|reconciled)\b/i.test(lower) ||
    /\bwe (had a|had an|got into (a )?)(fight|argument|disagreement|conflict|rupture)\b/i.test(lower) ||
    /\b(i|we)\s+had\s+a\s+conflict\b/i.test(lower) ||
    /\b(had|have)\s+an?\s+(fight|argument|disagreement|conflict|rupture)\b/i.test(lower) ||
    /\b(she|he|they)\s+(was|were)\s+being\b/i.test(lower) ||
    /\b(i|we)\s+stopped\s+engaging\b/i.test(lower) ||
    /\bwe\s+stopped\s+(talking|texting|hanging)\b/i.test(lower) ||
    /\bstopped\s+(talking|texting)\s+(to\s+each\s+other|completely)\b/i.test(lower) ||
    /\b(blew\s+up|blown\s+up|shut\s+down|stonewall(ed|ing)?|silent\s+treatment|cold\s+shoulder)\b/i.test(lower) ||
    /\b(ghost(ed)?|blocked\s+me|unfollow(ed)?)\b/i.test(lower) ||
    /\b(cheated\s+on|lied\s+to|betray(ed)?|crossed\s+(a\s+)?line)\b/i.test(lower) ||
    /\b(apologiz(ed|ing)|(?:said|offered)\s+an?\s+apology|forg(?:ave|ive|iveness))\b/i.test(lower) ||
    /\b(clear(ed)?\s+the\s+air|make\s+amends|sat\s+down\s+(together\s+)?to\s+talk|couples\s+therapy)\b/i.test(lower) ||
    /\b(she|he|they) (said|told me|texted|called|left|walked out|yelled|was upset|didn'?t)\b/i.test(lower) ||
    /\b(i|we) (went to|walked out|during the|after (she|he|they|that)|before (she|he|that))\b/i.test(lower);

  const situationalAnchor =
    /\b(last (week|month|year|night|summer|time)|at work|at home|during (the )?(vacation|trip|party|holiday|call)|when we were)\b/i.test(
      lower,
    ) ||
    /\b(that\s+night|the\s+next\s+morning|right\s+before\s+the\s+wedding|on\s+the\s+drive\s+home|over\s+text|in\s+the\s+kitchen|at\s+dinner)\b/i.test(
      lower,
    ) ||
    /\b(a\s+few\s+years\s+ago|back\s+in\s+(high\s+school|college)|during\s+covid|when\s+we\s+were\s+living)\b/i.test(
      lower,
    ) ||
    /\bafter\s+(she|he|they)\s+moved\s+out\b/i.test(lower) ||
    /\b(about (the )?(money|kids|trust|cheating|sleep|chores|deadline|schedule))\b/i.test(lower);

  /**
   * Safety net for long first-person narratives that clearly describe one conflict episode
   * but can miss narrower regex combinations (e.g. "there was a time ... we cut each other out ...").
   */
  const explicitNarrativeLead =
    /\b(there was a time|one time|at one point|i remember when)\b/i.test(lower) &&
    /\b(i|my|we)\b/i.test(lower);
  const conflictEpisodeLexicon =
    /\b(argument|fight|disagreement|conflict|stopped talking|stopped texting|cut each other out|had a falling out|fell out|made up|talked again|worked out|resolved)\b/i.test(
      lower,
    );
  const strongNarrativeOverride =
    wc >= 35 && explicitNarrativeLead && relationalAnchor && conflictEpisodeLexicon;

  const concrete =
    strongNarrativeOverride ||
    (namedPersonConflictAnchor && wc >= 18) ||
    (relationalAnchor && (dyadicOrEpisode || situationalAnchor || wc >= 40)) ||
    (dyadicOrEpisode && (relationalAnchor || situationalAnchor || wc >= 28));

  if (wc >= 80 || /\bbest friend\b/i.test(lower) || /\bthere was a time\b/i.test(lower)) {
  }

  return concrete;
}

/** Single runtime pivot when the user has no strong behavioral example (legacy transcripts only). */
export const MOMENT_5_INEXPERIENCE_FALLBACK_QUESTION =
  "What would meaningful celebration look like to you — either something you'd want to do for someone, or something that would feel meaningful to receive?";

export function isMoment5InexperienceFallbackPrompt(text: string): boolean {
  const lower = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return (
    lower.includes('what would meaningful celebration') &&
    lower.includes('look like to you') &&
    lower.includes('want to do for someone') &&
    lower.includes('meaningful to receive')
  );
}

/**
 * True when text contains the Moment 5 accountability follow-up ask (scripted or common model paraphrase).
 * Conflict-validity clarifications that only nudge "your part" without a direct accountability question are excluded.
 */
export function looksLikeMoment5AccountabilityProbeAssistantPrompt(text: string | null | undefined): boolean {
  const raw = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return false;
  const t = raw.toLowerCase();
  const directAccountabilityAsk =
    t.includes('what do you think you did or said that contributed to the conflict') ||
    t.includes('what do you think you did or said that contributed to it') ||
    t.includes('contributed to the conflict') ||
    t.includes('what was your part in how it unfolded') ||
    (t.includes('your part') && t.includes('unfolded')) ||
    (t.includes('appreciate you getting vulnerable') &&
      (t.includes('contributed to the conflict') || t.includes('your part'))) ||
    /\bwhat was your part in how\b/.test(t) ||
    /\bwhat part did you play\b/.test(t) ||
    /\byour part in how it (all )?(started|began|unfolded|played out|happened|went)\b/.test(t) ||
    (t.includes('specific time you had a conflict') &&
      (t.includes('contributed') || t.includes('your part')));
  if (!directAccountabilityAsk) return false;
  /** Soft "hear more about your part" tail on conflict-validity clarifications — not the scripted probe. */
  if (
    looksLikeMoment5ConflictValidityClarificationPrompt(raw) &&
    !/\bwhat was your part\b/.test(t) &&
    !/\bwhat part did you play\b/.test(t) &&
    !/\byour part in how\b/.test(t)
  ) {
    return false;
  }
  return true;
}

/**
 * When the client already delivered the accountability probe, remove a duplicate ask that the model glued
 * into the same paragraph (post-processing only sees one `\\n\\n` block).
 */
export function stripEmbeddedMoment5AccountabilityProbeAsk(draft: string): string {
  const t0 = (draft ?? '').trim();
  if (!t0) return draft;
  let t = normalizeInterviewTypography(t0);
  const patterns: RegExp[] = [
    /\bI appreciate you getting vulnerable with me\.?\s*/gi,
    /\bThat makes sense as a general approach\.?\s*/gi,
    /\bwhat do you think you did or said that contributed to (the conflict|it)\b[\s\S]{0,120}?\?/gi,
    /\bwhat was your part in how\b[\s\S]{0,120}?\?/gi,
    /\bwhat part did you play\b[\s\S]{0,120}?\?/gi,
    /\b(?:can|could)\s+you\s+think\s+of\s+a\s+specific\s+time\b[\s\S]{0,420}?\b(contributed|your part)\b[\s\S]{0,120}?\?/gi,
  ];
  let prev = '';
  while (prev !== t) {
    prev = t;
    for (const re of patterns) {
      t = t.replace(re, '').replace(/\s{2,}/g, ' ').trim();
    }
  }
  return t
    .replace(/^\s*[.,;—–\-–]\s*/g, '')
    .replace(/\s+[.,;—–\-–]\s*$/g, '')
    .trim();
}

/**
 * Parallel streaming TTS flushes by sentence before duplicate stripping on the full assistant turn.
 * When the accountability probe was already spoken, suppress model echoes in a flushed chunk.
 *
 * @returns `null` when the whole flushed sentence should be skipped for TTS; otherwise the text to speak.
 */
export function stripMoment5AccountabilityProbeStreamingEcho(
  spoken: string,
  accountabilityProbeAlreadyAsked: boolean,
): string | null {
  const t0 = normalizeInterviewTypography((spoken ?? '').trim());
  if (!accountabilityProbeAlreadyAsked || !t0) {
    return t0;
  }
  if (looksLikeMoment5AccountabilityProbeAssistantPrompt(t0)) {
    return null;
  }
  if (
    /\bwhat do you think you did or said that contributed\b/i.test(t0) ||
    /\bwhat was your part in how\b/i.test(t0) ||
    /\bwhat part did you play\b/i.test(t0)
  ) {
    return null;
  }
  return t0;
}

/** Emma's closing line from Scenario A — verbatim or common ASR variants. */
export function scenarioAEmmaVeryClearClosingLineMentioned(text: string): boolean {
  const t = text.toLowerCase().replace(/\u2019/g, "'");
  return (
    t.includes("you've made that very clear") ||
    t.includes('you have made that very clear') ||
    /\byou\s+made\s+that\s+very\s+clear\b/.test(t)
  );
}

/**
 * True when assistant text re-asks about Emma's "you've made that very clear" line — canonical framework copy
 * or common model paraphrases ("What did you think when Emma said…").
 */
export function scenarioAEmmaVeryClearContemptReask(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'");
  if (!t || t.length > 360) return false;
  /** Vignette body embeds the line narratively — not a contempt re-ask. */
  if (t.includes('dinner plans') && t.includes('ryan takes a call')) return false;
  if (!scenarioAEmmaVeryClearClosingLineMentioned(t)) return false;
  /** Streaming may flush the em-dash lead before the "what do you make of…?" tail — not a delivered probe yet. */
  if (/\bwhat about when emma says\b/.test(t) && !/\bwhat do you make of\b/.test(t)) {
    return false;
  }

  const reaskCue =
    /\bwhat about when emma says\b/.test(t) ||
    /\bwhat do you make of\b/.test(t) ||
    /\bwhat (?:did|do) you think (?:about )?when\b/.test(t) ||
    /\bhow do you (?:read|take|understand)\b/.test(t) ||
    (/\bwhen\s+(?:emma|she)\s+said\b/.test(t) && /\b(very\s+clear|made\s+that)\b/.test(t));

  return reaskCue;
}

/** Canonical Scenario A contempt probe — client-forced and orphan-stream fallback. */
export const SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY =
  "What about when Emma says 'you've made that very clear' — what do you make of that?";

/**
 * TTS-only for contempt-probe audio — omits vocalizing Emma's quoted line (vignette already contains it).
 * Transcript/card keep {@link SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY}.
 */
export const SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY =
  'What about when Emma says that — what do you make of that?';

/** @deprecated Alias — use {@link SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY}. */
export const SCENARIO_A_CONTEMPT_PROBE_RESUME_REPEAT_TTS_COPY = SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY;

/** Map assistant speech (transcript/canonical) to contempt-probe TTS without re-vocalizing Emma's quote. */
export function scenarioAContemptProbeTtsSpokenText(assistantSpeechText: string): string {
  const stored = (assistantSpeechText ?? '').trim();
  if (!stored) return assistantSpeechText;
  if (stored.includes(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY)) {
    return stored.replace(
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
      SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY,
    );
  }
  if (looksLikeScenarioAContemptProbeQuestion(stored)) {
    return SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY;
  }
  return assistantSpeechText;
}

/**
 * Repeat/resume TTS for the contempt probe — speak the full delivered line (including Emma's quote).
 * Initial playback uses {@link scenarioAContemptProbeTtsSpokenText} to avoid re-vocalizing the vignette line.
 */
export function scenarioAContemptProbeResumeRepeatTtsText(storedAssistantText: string): string {
  const stored = (storedAssistantText ?? '').trim();
  if (!stored) return storedAssistantText;
  if (
    stored.includes(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY) ||
    looksLikeScenarioAContemptProbeQuestion(stored)
  ) {
    return SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
  }
  return storedAssistantText;
}

/** Canonical Scenario A repair ask after the contempt probe — injected when duplicate-strip empties the model turn. */
export const SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY =
  'And if you were Ryan? How would you repair this situation?';

/** Scenario A contempt probe — "What about when Emma says 'you've made that very clear'…" */
export function looksLikeScenarioAContemptProbeQuestion(text: string): boolean {
  const tNorm = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'");
  if (
    /\bwhat do you make of emma'?s response there\b/.test(tNorm) ||
    /\bwhat did you think of emma'?s response there\b/.test(tNorm) ||
    /\bwhat do you make of emma'?s statement there\b/.test(tNorm)
  ) {
    return true;
  }
  if (scenarioAEmmaVeryClearContemptReask(text)) return true;
  const t = text.toLowerCase().replace(/\u2019/g, "'");
  const mentionsEmmaClosingLine = scenarioAEmmaVeryClearClosingLineMentioned(t);
  const makeOfEmmaVeryClearProbe =
    /\bwhat\s+do\s+you\s+make\s+of\b/.test(t) &&
    /\bemma\b/.test(t) &&
    /\b(very\s+clear|you'?ve\s+made\s+that|you\s+made\s+that)\b/.test(t);
  const shortGarbledMakeOfEmma =
    t.length < 220 &&
    /\bwhat do you make of\b/.test(t) &&
    /\bemma\b/.test(t) &&
    /\bvery\s+clear\b/.test(t);
  return makeOfEmmaVeryClearProbe || shortGarbledMakeOfEmma || (mentionsEmmaClosingLine && /\bwhat do you make of emma'?s statement\b/.test(t));
}

/**
 * Streaming TTS may flush before the "what do you make of that?" tail after an em dash.
 * Hold the Emma-line lead until the next sentence completes the contempt probe.
 */
export function isIncompleteScenarioAContemptProbeLeadSentence(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'");
  if (!t) return false;
  /** Defer em-dash split leads even when reask heuristics would treat the chunk as a full probe. */
  if (
    scenarioAEmmaVeryClearClosingLineMentioned(t) &&
    /\bwhat about when emma says\b/.test(t) &&
    !/\bwhat do you make of (that|it|emma)\b/.test(t)
  ) {
    return true;
  }
  if (looksLikeScenarioAContemptProbeQuestion(text)) return false;
  if (!scenarioAEmmaVeryClearClosingLineMentioned(t)) return false;
  if (/\bwhat do you make of (that|it)\b/.test(t)) return false;
  return (
    /\bwhat about when emma says\b/.test(t) ||
    (/\bwhat (?:did|do) you think when\b/.test(t) && /\bwhen\s+(?:emma|she)\s+said\b/.test(t))
  );
}

/**
 * Parallel streaming may defer the Emma-line lead, then flush the full contempt probe as the next sentence.
 * Prepend only when the next chunk is not already a complete probe (avoids hearing the quote twice).
 */
export function mergeDeferredScenarioAContemptProbeLeadWithNextSentence(
  deferredLead: string,
  nextSentence: string,
): string {
  const lead = (deferredLead ?? '').trim();
  const next = (nextSentence ?? '').trim();
  if (!lead) return next;
  if (!next) return lead;
  if (looksLikeScenarioAContemptProbeQuestion(next)) {
    return next;
  }
  const nextNorm = next.toLowerCase().replace(/\u2019/g, "'");
  const leadNorm = lead.toLowerCase().replace(/\u2019/g, "'");
  if (
    scenarioAEmmaVeryClearClosingLineMentioned(nextNorm) &&
    nextNorm.includes(leadNorm.slice(0, Math.min(leadNorm.length, 48)))
  ) {
    return next;
  }
  return `${lead} ${next}`.trim();
}

/** Remove repeated Scenario A contempt-probe asks after one was already delivered (model loop / ASR variants). */
export function stripScenarioAContemptProbeQuestion(text: string): string {
  let s = text;
  const removals: RegExp[] = [
    /\n?\s*What about when Emma says[^\n]*?\bwhat do you make of (that|it)\??\s*/gi,
    /\n?\s*What do you make of Emma['\u2019]s statement when she says[^\n]*?\??\s*/gi,
    /\n?\s*What (?:did|do) you think when[^\n]*?(?:very\s+clear|made that very clear)[^\n?]*\??\s*/gi,
    /\n?\s*What do you make of[^\n]{0,140}Emma[^\n]{0,180}very clear[^\n.?!]*\??\s*/gi,
    /\n?\s*What do you make of[\s\S]{0,320}?Emma[\s\S]{0,360}?(?:very\s+clear|you'?ve\s+made|you\s+made\s+that)[\s\S]{0,120}?\??\s*/gi,
  ];
  for (const re of removals) {
    s = s.replace(re, '\n');
  }
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

/** When the contempt probe was already delivered, remove a duplicate ask glued into the same paragraph. */
export function stripEmbeddedScenarioAContemptProbeAsk(draft: string): string {
  const t0 = (draft ?? '').trim();
  if (!t0) return draft;
  let t = normalizeInterviewTypography(t0);
  const patterns: RegExp[] = [
    /\bWhat about when Emma says[\s\S]{0,220}?\bwhat do you make of (?:that|it)\??\s*/gi,
    /\bWhat do you make of Emma['\u2019]s statement when she says[\s\S]{0,220}?\??\s*/gi,
    /\bWhat (?:did|do) you think when[\s\S]{0,220}?(?:very\s+clear|made that very clear)[\s\S]{0,80}?\??\s*/gi,
    /\bWhat do you make of[\s\S]{0,320}?Emma[\s\S]{0,360}?(?:very\s+clear|you'?ve\s+made|you\s+made\s+that)[\s\S]{0,120}?\??\s*/gi,
  ];
  let prev = '';
  while (prev !== t) {
    prev = t;
    for (const re of patterns) {
      t = t.replace(re, '').replace(/\s{2,}/g, ' ').trim();
    }
  }
  return t
    .replace(/^\s*[.,;—–\-–]\s*/g, '')
    .replace(/\s+[.,;—–\-–]\s*$/g, '')
    .trim();
}

/**
 * Parallel streaming TTS flushes by sentence before duplicate stripping on the full assistant turn.
 * When the Scenario A contempt probe was already spoken, suppress model echoes in a flushed chunk.
 */
export function stripScenarioAContemptProbeStreamingEcho(
  spoken: string,
  contemptProbeAlreadyAsked: boolean,
): string | null {
  const t0 = normalizeInterviewTypography((spoken ?? '').trim());
  if (!contemptProbeAlreadyAsked || !t0) {
    return t0;
  }
  if (looksLikeScenarioAContemptProbeQuestion(t0) || scenarioAEmmaVeryClearContemptReask(t0)) {
    return null;
  }
  return t0;
}

export type Moment5AccountabilityProbeEvaluation = {
  shouldProbe: boolean;
  /** Machine-readable: why we fire the scripted probe, or why we skip it. */
  reason:
    | 'lacks_explicit_self_accountability'
    | 'explicit_self_accountability'
    | 'too_short'
    | 'decline_or_vague_evade';
  selfReference: Moment5AccountabilitySelfReferenceEvaluation;
};

export type Moment5AccountabilitySelfReferenceType =
  | 'general_advice'
  | 'specific_ownership'
  | 'boundary_expression'
  | 'process_description';

export type Moment5AccountabilitySelfReferenceEvaluation = {
  accountability_probe_self_reference_detected: boolean;
  self_reference_type: Moment5AccountabilitySelfReferenceType;
};

/**
 * Voluntary ownership of one's part in the conflict — **not** mere first-person narration
 * ("I felt…", "I said…", "I remember…") which can still be blame-only.
 */
export function moment5AnswerHasExplicitSelfAccountability(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  return (
    /\bi\s+contributed\b/i.test(t) ||
    /\bmy\s+role\s+(was|here|in\s+that)\b/i.test(lower) ||
    /\bmy\s+part\s+(was|here|in\s+that)\b/i.test(lower) ||
    /\bhow\s+i\s+(contributed|acted|handled|messed up|made things worse|made it worse)\b/i.test(lower) ||
    /\bwhat\s+i\s+did\s+wrong\b/i.test(lower) ||
    /\bI\s+realiz(?:e|ed)\s+i\b/i.test(t) ||
    /\bI\s+realis(?:e|ed)\s+i\b/i.test(t) ||
    /\bi\s+also\s+(knew|realized|realised|should|could|regret|thought\s+i\s+was|had\s+to\s+admit|felt\s+responsible|took\s+(some\s+)?(blame|responsibility)|owned)\b/i.test(lower) ||
    /\bmy\s+(fault|mistake)\b/i.test(lower) ||
    /\b(that|this)\s+was\s+on\s+me\b/i.test(lower) ||
    /\bI\s+take\s+responsibility\b/i.test(t) ||
    /\bi\s+took\s+responsibility\b/i.test(lower) ||
    /\bi\s+take\s+ownership\b/i.test(lower) ||
    /\bi\s+took\s+ownership\b/i.test(lower) ||
    /\bi\s+own(?:ed)?\s+(my|that|it)\b/i.test(lower) ||
    /\bi\s+own(?:ed)?\s+my\s+side\b/i.test(lower) ||
    /\bmy\s+side\s+of\s+(this|it|that)\b/i.test(lower) ||
    /\bmy\s+responsibilit(?:y|ies)\s+was\b/i.test(lower) ||
    /\bI\s+was\s+(wrong|at fault|to blame|unfair|defensive|too harsh)\b/i.test(t) ||
    /\bi\s+was\s+(out\s+of\s+line|disrespectful|controlling|accusatory)\b/i.test(lower) ||
    /\bi\s+crossed\s+a\s+line\b/i.test(lower) ||
    /\bi\s+did\s+(yell|raise\s+my\s+voice|snap|shut\s+down|stonewall|withdraw|avoid)\b/i.test(lower) ||
    /\bi\s+shut\s+(him|her|them)\s+out\b/i.test(lower) ||
    /\bi\s+(wasn'?t|was\s+not|didn'?t)\s+listen(?:ing)?\b/i.test(lower) ||
    /\bi\s+(got|became)\s+(defensive|reactive)\b/i.test(lower) ||
    /\bi\s+got\s+accusatory\b/i.test(lower) ||
    /\bi\s+came\s+in\s+hot\b/i.test(lower) ||
    /\bi\s+came\s+at\s+(him|her|them)\s+hard\b/i.test(lower) ||
    /\bI\s+(should|could)\s+have\b/i.test(t) ||
    /\bi\s+should(?:n'?t| not)\s+have\s+reacted\s+like\s+that\b/i.test(lower) ||
    /\bi\s+could\s+have\s+communicat(?:ed|e)\s+better\b/i.test(lower) ||
    /\bI\s+wish\s+I(\s+had)?\b/i.test(t) ||
    /\bI\s+(apologized|apologised)\b/i.test(t) ||
    /\bI\s+('?m|am)\s+sorry\s+(for\s+)?(what\s+i|my|how\s+i)\b/i.test(t) ||
    /\bI\s+(owned|admitted)\b/i.test(t) ||
    /\bI\s+acknowledged\s+(that|my|the|I)\b/i.test(t) ||
    /\bI\s+(overreacted|escalated)\b/i.test(t) ||
    /\bi\s+handled\s+(it|that)\s+(badly|poorly)\b/i.test(lower) ||
    /\bi\s+was\s+projecting\b/i.test(lower) ||
    /\bi\s+(made|was\s+making)\s+assumptions\b/i.test(lower) ||
    /\bi\s+jumped\s+to\s+conclusions\b/i.test(lower) ||
    /\bmy\s+share\s+of\b/i.test(lower) ||
    /\b(part|role)\s+i\s+(played|had|took)\b/i.test(lower) ||
    /\bI\s+regret\s+(what\s+i|my|how\s+i|that\s+i)\b/i.test(t) ||
    /\bI\s+see\s+(now\s+)?that\s+i\b/i.test(t) ||
    (/\blooking\s+back,?\s+i\b/i.test(lower) &&
      /\b(wrong|should|could|regret|fault|mistake|overreact|unfair|defensive)\b/i.test(lower))
  );
}

export function evaluateMoment5AccountabilitySelfReference(
  userText: string
): Moment5AccountabilitySelfReferenceEvaluation {
  const t = userText.replace(/\s+/g, ' ').trim();
  const lower = t.toLowerCase();
  if (!t) {
    return { accountability_probe_self_reference_detected: false, self_reference_type: 'process_description' };
  }

  const boundaryExpression =
    /\bi\s+(would\s+have\s+appreciated|would'?ve\s+appreciated)\b/i.test(lower) ||
    /\bi\s+(set\s+a\s+limit|set\s+a\s+boundary)\b/i.test(lower) ||
    /\bi\s+don'?t\s+take\s+(your|his|her|their|someone'?s)?\s*(opinion|criticism|feedback)\s+seriously\b/i.test(
      lower
    ) ||
    /\bi\s+told\s+(him|her|them)\b.{0,120}\b(appreciated|limit|boundary|don'?t\s+take)\b/i.test(lower);
  if (boundaryExpression) {
    return { accountability_probe_self_reference_detected: true, self_reference_type: 'boundary_expression' };
  }

  const specificConflictSelfReference =
    moment5AnswerHasExplicitSelfAccountability(t) ||
    /\bi\s+(yelled|shouted|snapped|raised\s+my\s+voice|got\s+triggered|was\s+triggered|shut\s+down|withdrew|walked\s+away|stormed\s+off|avoided|stonewalled|got\s+defensive|became\s+defensive|overreacted|escalated|calmed\s+down|regulated\s+myself|apologized|apologised)\b/i.test(
      lower
    ) ||
    /\bi\s+(didn'?t|did\s+not)\s+(communicate|listen|say|explain|understand|handle)\b/i.test(lower) ||
    /\bi\s+felt\s+(hurt|dismissed|angry|upset|triggered|defensive|insecure|attacked|criticized|criticised|disrespected)\b/i.test(
      lower
    ) ||
    /\bi\s+(said|told|asked)\s+(him|her|them)\b/i.test(lower) ||
    /\bi\s+was\s+the\s+one\s+who\b/i.test(lower) ||
    /\bi\s+got\s+triggered\s+because\b/i.test(lower) ||
    /\bi\s+was\s+(just\s+)?(starting\s+out|insecure)\b/i.test(lower);
  if (specificConflictSelfReference) {
    return { accountability_probe_self_reference_detected: true, self_reference_type: 'specific_ownership' };
  }

  const generalAdvice =
    /\bi\s+(think|believe|find|feel)\s+(it'?s|it\s+is)?\s*(important|helpful|better|good|useful)\b/i.test(lower) ||
    /\b(communication|listening|taking\s+turns|repeat(?:ing)?\s+back)\s+is\s+(just\s+)?(really\s+)?(important|helpful|useful)\b/i.test(
      lower
    ) ||
    /\bi\s+(always|usually|generally|try\s+to|like\s+to|make\s+sure)\b.{0,80}\b(conflict|heard|understood|listen|repeat|communicat|take\s+turns)\b/i.test(
      lower
    );
  return {
    accountability_probe_self_reference_detected: false,
    self_reference_type: generalAdvice ? 'general_advice' : 'process_description',
  };
}

/**
 * Moment 5: true when the user's answer is **abstract** for pipeline purposes — no anchored episode,
 * no concrete first-person behavior in a described conflict, only generic principles or process habits.
 * Used after the specificity redirect to decide accountability-probe vs move-on.
 */
export function moment5ResponseIsAbstract(userText: string): boolean {
  const raw = userText.replace(/\s+/g, ' ').trim();
  if (!raw || raw.length < 20) return true;
  if (moment5PersonalNarrativeHasConcreteAnchor(raw)) return false;
  if (moment5AnswerHasExplicitSelfAccountability(raw)) return false;

  const sr = evaluateMoment5AccountabilitySelfReference(raw);
  if (sr.self_reference_type === 'specific_ownership' || sr.self_reference_type === 'boundary_expression') {
    return false;
  }

  const lower = raw.toLowerCase();
  /** Named other + narrative cue — not abstract even if {@link moment5PersonalNarrativeHasConcreteAnchor} missed an edge case. */
  if (
    MOMENT5_LIKELY_PROPER_NAME_RE.test(raw) &&
    /\b(called|said|told|would|did|got|felt|when|after|during|because|argu|fight|tense|upset|judged|coach|conflict|resolved|facilitator)\b/i.test(
      raw,
    )
  ) {
    return false;
  }
  if (
    /\b(with|from)\s+[A-Z][a-z]{1,24}\b/i.test(raw) &&
    /\b(said|told|would|did|got|felt|when|after|during|because|argu|fight|tense)\b/i.test(raw)
  ) {
    return false;
  }
  if (
    /\b(last\s+(year|month|week|night)|during\s+the\s+breakup|after\s+the\s+argument|one\s+time|at\s+one\s+point|a\s+few\s+years\s+ago)\b/i.test(
      lower,
    )
  ) {
    return false;
  }
  /** Concrete first-person act in conflict context (broader than explicit accountability). */
  if (
    /\bi\s+(shut\s+down|walked\s+away|yelled|snapped|avoided|stonewall|said\s+something|didn'?t\s+listen|stopped\s+listening|overreacted|escalated)\b/i.test(
      lower,
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Client-injected specificity redirect — independent of accountability `shouldProbe`.
 * Thin answers (`too_short`) previously skipped the redirect block and hit the model, which could
 * yield elongating-only turns stripped to empty transcript rows.
 */
/** True when the current reply or prior M5 user turns already anchor a concrete episode. */
export function moment5UserOrTranscriptHasConcreteAnchor(
  userText: string,
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
): boolean {
  if (moment5PersonalNarrativeHasConcreteAnchor(userText)) return true;
  return moment5TranscriptHasConcreteAnchor(transcript);
}

export function shouldInjectMoment5SpecificityRedirect(params: {
  userText: string;
  narrativeConcrete: boolean;
  answeringAfterSpecificityRedirect: boolean;
  specificityRedirectIssued: boolean;
  specificityRedirectInTranscript: boolean;
}): boolean {
  if (moment5PersonalNarrativeHasConcreteAnchor(params.userText)) return false;
  if (params.narrativeConcrete) return false;
  if (params.answeringAfterSpecificityRedirect) return false;
  if (params.specificityRedirectIssued || params.specificityRedirectInTranscript) return false;
  const evalResult = evaluateMoment5AccountabilityProbe(params.userText);
  if (evalResult.reason === 'too_short') return true;
  /** Any non-thin answer without a concrete anchor needs specificity before resolution/accountability/API. */
  return true;
}

/**
 * At most one scripted follow-up: fire unless the user already names their **own** contribution
 * to the tension (not only story-telling or other-blame).
 */
export function evaluateMoment5AccountabilityProbe(userText: string): Moment5AccountabilityProbeEvaluation {
  const t = userText.replace(/\s+/g, ' ').trim();
  const lower = t.toLowerCase();
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  const selfReference = evaluateMoment5AccountabilitySelfReference(t);
  const signals = analyzeMoment5AccountabilityProbeSignals(t);

  console.log('[AccountabilityProbe] response text:', t.slice(0, 200));
  console.log('[AccountabilityProbe] hasNarrative:', signals.hasNarrative);
  console.log('[AccountabilityProbe] hasSelfReference:', selfReference.accountability_probe_self_reference_detected);
  console.log('[AccountabilityProbe] hasStrongAccountability:', signals.hasStrongAccountability);
  console.log('[AccountabilityProbe] hasModerateSelfRef:', signals.hasModerateSelfRef);
  console.log('[AccountabilityProbe] hasConflictKeyword:', signals.hasConflictKeyword);
  console.log('[AccountabilityProbe] hasConflictEpisodeContext:', signals.hasConflictEpisodeContext);

  if (moment5UserDeclinesConcreteReask(t)) {
    return { shouldProbe: false, reason: 'decline_or_vague_evade', selfReference };
  }
  if (t.length < 36 || wordCount < 10) {
    return { shouldProbe: false, reason: 'too_short', selfReference };
  }
  if (/\b(i don'?t have|nothing comes|can'?t think|no conflict|never really|not sure what to say)\b/i.test(lower) && t.length < 100) {
    return { shouldProbe: false, reason: 'decline_or_vague_evade', selfReference };
  }

  const probeConditionMet = shouldFireAccountabilityProbe(t);
  console.log('[AccountabilityProbe] probeConditionMet:', probeConditionMet);

  if (probeConditionMet) {
    return { shouldProbe: true, reason: 'lacks_explicit_self_accountability', selfReference };
  }
  return { shouldProbe: false, reason: 'explicit_self_accountability', selfReference };
}

/** @deprecated Prefer {@link evaluateMoment5AccountabilityProbe} for logging; boolean is equivalent to `shouldProbe`. */
export function shouldProbeMoment5NoSelfReference(userText: string): boolean {
  return evaluateMoment5AccountabilityProbe(userText).shouldProbe;
}

/**
 * True when assistant content embeds the **scripted Moment 5 conflict question** (possibly inside a
 * longer client bundle with reflection + pivot). Use for closing gates and post-M5 user-turn counting
 * when {@link isMoment5AssistantAnchor} is too strict for sanitized typography.
 */
export function transcriptAssistantContainsMoment5PrimaryConflictQuestion(content: string | null | undefined): boolean {
  if (content == null || typeof content !== 'string') return false;
  if (looksLikeMoment5AccountabilityProbeAssistantPrompt(content)) return false;
  if (isMoment5AssistantAnchor(content)) return true;
  const lower = content.replace(/\s+/g, ' ').trim().toLowerCase();
  const hasConflictIntro = lower.includes('think of a time when you had a conflict with someone important');
  const hasResolutionAsk =
    lower.includes('how did things get resolved') ||
    (lower.includes('what happened') && lower.includes('resolved'));
  return hasConflictIntro && hasResolutionAsk;
}

/**
 * True when TTS has reached the scripted M5 conflict intro (including the first streaming sentence).
 * Used to refresh Show scenario as soon as the conflict question begins, not after the full bundle ends.
 */
export function spokenTextStartsMoment5PrimaryConflictQuestion(content: string | null | undefined): boolean {
  if (content == null || typeof content !== 'string') return false;
  if (looksLikeMoment5AccountabilityProbeAssistantPrompt(content)) return false;
  const lower = content.replace(/\s+/g, ' ').trim().toLowerCase();
  return lower.includes('think of a time when you had a conflict with someone important');
}

/**
 * True when an assistant turn is (or contains) the Moment 5 primary prompt, legacy appreciation prompts,
 * or related pivots. Used to slice the transcript for post-interview Moment 5 scoring.
 */
export function isMoment5AssistantAnchor(content: string | null | undefined): boolean {
  if (!content) return false;
  if (looksLikeMoment4ThresholdQuestion(content)) return false;
  const c = content.replace(/\s+/g, ' ').trim();
  const lower = c.toLowerCase();
  if (lower.includes('conflict or disagreement with someone important')) return true;
  if (
    lower.includes('think of a time when you had a conflict with someone important') &&
    lower.includes('how did things get resolved')
  ) {
    return true;
  }
  /** Common Sonnet paraphrase of the scripted conflict prompt (not matched by canonical strings). */
  if (
    /\btell me about a specific conflict\b/i.test(c) &&
    /\b(someone important|important in your life|important to you)\b/i.test(lower) &&
    /\b(resolved|resolution|didn'?t)\b/i.test(lower)
  ) {
    return true;
  }
  if (lower.includes('tell me about a time you had a conflict') && lower.includes('how did it get resolved')) {
    return true;
  }
  if (isMoment5InexperienceFallbackPrompt(c)) return true;
  if (lower.includes('think of a time you really celebrated someone')) return true;
  if (lower.includes('really celebrated') && /\b(your life|in your life|them that|show them)\b/.test(lower)) {
    return true;
  }
  if (lower.includes('really got to show someone close to you') && lower.includes('mattered')) return true;
  if (
    /\b(moment you celebrated someone|celebrated someone who mattered)\b/.test(lower) ||
    (/\bcelebrated someone\b/.test(lower) &&
      /\b(mattered|meaningful|close to you|in your life|your life)\b/.test(lower))
  ) {
    return true;
  }
  if (
    /\bshow(?:ed)? up for someone\b/.test(lower) &&
    /\b(what comes to mind|time|moment|talk about|can we|love to hear|curious|tell me)\b/.test(lower)
  ) {
    return true;
  }
  if (lower.includes('what did you do to show them that')) return true;
  if (
    /\bwarmer beat from your own life\b/.test(lower) &&
    /\b(celebrat|appreciat|generous|show up)\b/.test(lower)
  ) {
    return true;
  }
  if (
    /\bhearing where that line is for you\b/.test(lower) &&
    /\bgenerous instead of careful\b/.test(lower)
  ) {
    return true;
  }
  if (
    /\bhow you name that threshold\b/.test(lower) &&
    /\b(show them|celebrat|warmer|generous)\b/.test(lower)
  ) {
    return true;
  }
  if (
    /\btaking that in\b/.test(lower) &&
    /\b(celebrat|appreciat|warmer)\b/.test(lower) &&
    /\b(side|moment|beat|life)\b/.test(lower)
  ) {
    return true;
  }
  return false;
}

/** @deprecated Use {@link isMoment5AssistantAnchor} — name retained for legacy imports. */
export const isMoment5AppreciationAssistantAnchor = isMoment5AssistantAnchor;

export function moment5AcknowledgesLimitedCloseRelationshipExperience(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(haven'?t had many|haven'?t really had|few (close )?(relationships|friends)|not many (close )?(relationships|friends)|don'?t have many (close )?(relationships|friends|people)|limited experience|not a lot of close|no close friends|family (was never|is never|wasn'?t|isn'?t) (very )?(demonstrative|affectionate|warm)|family was never (really )?(demonstrative|affectionate)|not (very|really) demonstrative|hard to think of (a |any )?specific|don'?t have a great example|no great example|nothing (really )?specific|never really had (a )?(close |anyone )?|not many opportunities to|didn'?t grow up (with|in) (a |much )?(hug|affection)|we weren'?t big on (hugs|celebrat|showing))\b/i.test(
    t
  );
}

/** True when the user already articulated values / attunement without needing the scripted pivot. */
export function moment5HasSubstantiveCelebrationValuesReflection(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 48) return false;
  if (isMoment5AppreciationAbsenceOfSignal(text)) return false;
  const lower = t.toLowerCase();
  return /\b(meaningful celebration|what (would|might) (feel|look) meaningful|feel meaningful|something I'?d want to do (for|to)|want to do for someone|show (them |someone )?(I care|they matter)|be there (for|when)|what they (need|needed|value)|noticed (what|that)|attun|mentaliz|empath|validate their|visibly valued|personal(ized)? (note|gesture|touch)|mark(ed)? the moment|celebrate them as a person)\b/i.test(
    lower
  );
}

/** Concrete behavioral example: passes Moment 5 specificity (not generic) and is not absence-of-signal. */
export function moment5HasHighInformationBehavioralExample(text: string): boolean {
  if (isMoment5AppreciationAbsenceOfSignal(text)) return false;
  return !evaluateMoment5AppreciationSpecificity(text).isGeneric;
}

/**
 * Infer he/she/they for the appreciated person from the user's answer.
 * Defaults to inclusive "them" when unclear or mixed signals.
 */
function moment5TargetPronoun(userText: string): 'her' | 'him' | 'them' {
  const lower = userText.toLowerCase();
  const female =
    /\b(she|her|hers|girlfriend|wife|woman|girl|mom|mother|sister|aunt|daughter|grandmother|stepmom)\b/.test(
      lower
    );
  const male =
    /\b(he|him|his|boyfriend|husband|man|guy|dad|father|brother|uncle|son|grandfather|stepdad)\b/.test(
      lower
    );
  if (female && !male) return 'her';
  if (male && !female) return 'him';
  return 'them';
}

/**
 * Pulls a short infinitive phrase describing what the user did, for Moment 5 appreciation probes.
 * Returns null when we cannot extract confidently (caller may fall back).
 */
function extractMoment5AppreciationInfinitivePhrase(trimmed: string): string | null {
  const lower = trimmed.toLowerCase();

  if (
    /\b(birthday\s+party|surprise\s+party)\b/i.test(trimmed) &&
    /\b(threw|throw|gave|hosted|planned|organized|put\s+on)\b/i.test(trimmed)
  ) {
    const p = moment5TargetPronoun(trimmed);
    return `throw ${p} that party`;
  }

  if (
    /\b(threw|hosted|planned|organized|put\s+on)\b/i.test(trimmed) &&
    /\bparty\b/i.test(trimmed) &&
    !/\b(office|work|company)\s+party\b/i.test(lower)
  ) {
    const p = moment5TargetPronoun(trimmed);
    return `throw ${p} that party`;
  }

  if (/\bwrote\b/i.test(trimmed) && /\bletter\b/i.test(trimmed)) {
    const p = moment5TargetPronoun(trimmed);
    return `write ${p} that letter`;
  }

  if (/\bflew\s+in\b/i.test(lower) || /\bflying\s+in\b/i.test(lower)) {
    return /\bsurpris/i.test(lower) ? 'fly in as a surprise' : 'fly in like that';
  }

  if (/\b(drove|driving)\s+/i.test(trimmed) && /\b(surprise|unexpected|unannounced)\b/i.test(lower)) {
    return 'make that trip as a surprise';
  }

  if (/\bsurprised\s+(her|him|them)\b/i.test(lower)) {
    const m = lower.match(/\bsurprised\s+(her|him|them)\b/);
    const p = (m?.[1] as 'her' | 'him' | 'them' | undefined) ?? 'them';
    return `plan something like that surprise for ${p}`;
  }

  if (/\bcooked\b/i.test(lower) && /\b(dinner|meal|breakfast|lunch|brunch)\b/i.test(lower)) {
    const p = moment5TargetPronoun(trimmed);
    return `cook ${p} that meal`;
  }

  if (/\b(bought|got|picked\s+up)\b/i.test(lower) && /\bgift\b/i.test(lower)) {
    return 'choose that gift';
  }

  if (/\b(took|booked)\b/i.test(lower) && /\b(trip|vacation|getaway)\b/i.test(lower)) {
    return 'plan that trip';
  }

  if (/\bsent\b/i.test(lower) && /\b(flowers|a\s+care\s+package)\b/i.test(lower)) {
    return 'send something like that';
  }

  if (/\bmade\b/i.test(lower) && /\b(scrapbook|photo\s+album|playlist|video)\b/i.test(lower)) {
    const p = moment5TargetPronoun(trimmed);
    return `make something like that for ${p}`;
  }

  if (/\bcalled\b/i.test(lower) && /\b(just\s+to\s+check|to\s+see\s+how)\b/i.test(lower)) {
    const p = moment5TargetPronoun(trimmed);
    return `reach out to ${p} that way`;
  }

  const takeOutWho = lower.match(/\btake\s+(them|her|him)\s+out\b/)?.[1];
  if (takeOutWho) {
    if (/\bmeal\b/i.test(lower)) return `take ${takeOutWho} out for a meal like that`;
    if (/\bdinner\b/i.test(lower)) return `take ${takeOutWho} out to dinner like that`;
    return `take ${takeOutWho} out like that`;
  }

  if (/\bsend\s+(a\s+)?message\b/i.test(lower)) {
    const p = moment5TargetPronoun(trimmed);
    return `send ${p} a message like that`;
  }

  return null;
}

/**
 * MOMENT5_PROBE_WORDING — Moment 5 appreciation follow-up must echo the user's described act
 * (not a generic "that specifically" script). Used when the runtime forces a single probe.
 */
const MOMENT5_SPECIFIC_BRIDGE =
  "Do you have a specific moment that comes to mind — even something small? If nothing surfaces, that's okay too and we can move on.";

export function buildMoment5AppreciationProbeQuestion(userText: string): string {
  const trimmed = userText.replace(/\s+/g, ' ').trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) {
    return MOMENT5_SPECIFIC_BRIDGE;
  }
  if (/\b(always|usually|generally|typically)\b/.test(lower)) {
    return MOMENT5_SPECIFIC_BRIDGE;
  }
  const act = extractMoment5AppreciationInfinitivePhrase(trimmed);
  if (act) {
    return `What made you decide to ${act}?`;
  }
  return MOMENT5_SPECIFIC_BRIDGE;
}

/** Moment 5: probe only when there is no engagement — not for shallow/generic but on-topic answers. */
export function isMoment5AppreciationAbsenceOfSignal(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 8) return true;
  const lower = t.toLowerCase();
  if (
    /^(I )?(don'?t|do not) know\.?$|^(no|nope)\.?$|^not sure\.?$|^nothing\.?$|^pass\.?$|^skip\.?$|^idk\.?$/i.test(
      lower
    )
  ) {
    return true;
  }
  if (
    /^(nothing|can'?t think|nothing comes|no idea|nothing surfaces|hard to think)/i.test(lower) &&
    t.length < 40
  ) {
    return true;
  }
  return false;
}

const SCENARIO_B_TOPIC_RE =
  /\b(sarah|james|job|offer|celebrat|salary|commute|fight|blindsided|appreciat|tears?|tearful|cry|cries|promotion|hunt)\b/i;

/** Scenario B Q1: any on-topic engagement counts — shallow answers are scorable; do not force probes for depth. */
export function hasScenarioBQ1OnTopicEngagement(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 12) return false;
  if (SCENARIO_B_TOPIC_RE.test(t)) return true;
  const lower = t.toLowerCase();
  return (
    /\b(needed to feel|emotional bid|logistics alone|salary alone|commute alone|don'?t cry|tears? up|redirect(ing)?|trail(ed|ing) off|worth it)\b/.test(
      lower
    ) ||
    /\b(sarah needed|she needed|she wanted|he needed|he wanted)\b.*\b(comfort|validation|acknowledg|empathy|care|attunement)\b/.test(
      lower
    )
  );
}

const SCENARIO_C_TOPIC_RE =
  /\b(sophie|daniel|repair|argument|silent|avoid|come back|relationship|communicat|boundary|listen|upset|resolved)\b/i;

/** Scenario C Q2: on-topic repair engagement (separate from commitment-threshold probe forcing). */
export function hasScenarioCQ2OnTopicEngagement(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 10) return false;
  return SCENARIO_C_TOPIC_RE.test(t);
}

const SCENARIO_A_TOPIC_RE =
  /\b(emma|ryan|dinner|mother|mom|bill|call|family|first|wrong|tension|hurt|frustrat|angry|upset|clear)\b/i;

/** NBSP + apostrophe variants from ASR/TTS when matching Emma's closing line. */
export function normalizeInterviewApostrophesForMatching(s: string): string {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u02bc/g, "'")
    .replace(/\uff07/g, "'")
    .replace(/\u2032/g, "'");
}

/**
 * ASR often mishears "that line" as "lot line" / "lotline" when the user deictically refers to Emma's last beat.
 * Normalize before Scenario A contempt skip / coverage regexes.
 */
export function normalizeScenarioAThatLineAsrTypos(s: string): string {
  return s
    .replace(/\b[Ll]ot\s*line\b/g, 'that line')
    .replace(/\b[Ll]otline\b/g, 'that line');
}

/**
 * User echoed Emma's "you've made that very clear" (or a close ASR variant).
 * When true, do not ask the scripted contempt follow-up about that same line.
 */
export function userReferencesEmmaClosingLineQuote(text: string): boolean {
  const squashed = text.replace(/\s+/g, ' ').trim();
  const lower = normalizeScenarioAThatLineAsrTypos(
    normalizeInterviewApostrophesForMatching(squashed),
  )
    .replace(/\s+/g, ' ')
    .toLowerCase();

  if (lower.includes("you've made that very clear")) return true;
  if (lower.includes('you have made that very clear')) return true;

  const variantPatterns: RegExp[] = [
    /\byou\s+made\s+that\s+very\s+clear\b/i,
    /\byouve\s+made\s+that\s+very\s+clear\b/i,
    /\byou'?ve\s+made\s+that\s+(?:really|pretty|so)\s+clear\b/i,
    /\byou'?ve\s+made\s+(?:that\s+)?(?:it\s+)?very\s+clear\b/i,
    /\bi\s+know[, ]+\s*you'?ve\s+made\s+that\s+very\s+clear\b/i,
    /\bshe\s+said\s+['"\u201c]?\s*you\s*(?:'ve|have)\s+made\s+that\s+very\s+clear\b/i,
    /\bwhen\s+(?:emma\s+)?says\s+['"\u201c]?\s*you\s*(?:'ve|have)\s+made\s+that\s+very\s+clear\b/i,
    /\bemma\s+says\s+['"\u201c]?\s*you\s*(?:'ve|have)\s+made\s+that\s+very\s+clear\b/i,
  ];
  if (variantPatterns.some((re) => re.test(lower))) return true;

  const idxMade = lower.search(/\bmade\b/);
  const idxThatVeryClear = lower.search(/\bthat\s+very\s+clear\b/);
  if (idxMade >= 0 && idxThatVeryClear >= 0 && Math.abs(idxMade - idxThatVeryClear) <= 140) {
    const before = lower.slice(0, idxThatVeryClear + 24);
    if (/\byou\b/.test(before) || /\bemma\b/.test(before) || /\bshe\b/.test(before)) return true;
  }

  return false;
}

/** Minimal message shape for {@link aggregateScenario1Moment1UserTextForContemptGate}. */
export type Scenario1Moment1UserMessageLike = {
  role: string;
  content?: string;
  scenarioNumber?: number;
  interviewMoment?: number;
};

/**
 * Join all Scenario 1, interview-moment-1 user turns (e.g. initial Q1 + short resume follow-up).
 * Used so contempt-probe skip/coverage still sees Emma-line engagement after welcome-back when the
 * current utterance alone is too short to match.
 */
export function aggregateScenario1Moment1UserTextForContemptGate(
  messages: readonly Scenario1Moment1UserMessageLike[],
): string {
  const parts: string[] = [];
  for (const m of messages) {
    if (m.role !== 'user') continue;
    if ((m.scenarioNumber ?? 0) !== 1) continue;
    const im = m.interviewMoment;
    if (im !== undefined && im !== 1) continue;
    const c = String(m.content ?? '').trim();
    if (c) parts.push(c);
  }
  return parts.join('\n').trim();
}

/** Skip reasons for {@link evaluateScenarioAQ1ContemptProbePreProbeSkip} (auditable). */
export type ScenarioAContemptProbeSkipReason =
  | 'literal_quote_present'
  | 'register_addressed'
  | 'pattern_interpretation_tied_to_line';

/**
 * Pre-probe gate: if the user's **initial** Scenario A Q1 answer already engages Emma's final line,
 * the scripted contempt probe is redundant. Evaluates conditions 1–3 before {@link hasScenarioAQ1ContemptProbeCoverage}.
 */
export function evaluateScenarioAQ1ContemptProbePreProbeSkip(text: string): {
  skip: boolean;
  reason: ScenarioAContemptProbeSkipReason | null;
} {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 8) return { skip: false, reason: null };
  const lower = normalizeScenarioAThatLineAsrTypos(
    normalizeInterviewApostrophesForMatching(t),
  )
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const onScenarioATopic = SCENARIO_A_TOPIC_RE.test(t);

  /** Condition 1 — literal quote or close ASR variant (same line must not get a second scripted ask). */
  if (userReferencesEmmaClosingLineQuote(t)) return { skip: true, reason: 'literal_quote_present' };

  /** User named Emma/Ryan and described Emma's closing move ("not asking…", "already knows he won't") — same beat as "you've made that very clear". */
  const namesEmmaOrRyan = /\b(emma|ryan)\b/i.test(lower);
  const emmaClosingRhetoricNamed =
    onScenarioATopic &&
    namesEmmaOrRyan &&
    (/\bshe'?s\s+not\s+asking\s+(?:him|ryan|her)\s+to\s+stop\b/i.test(lower) ||
      /\bshe\s+isn'?t\s+asking\s+(?:him|ryan|her)\s+to\s+stop\b/i.test(lower) ||
      /\btelling\s+(?:him|ryan|her)\s+she\s+already\s+knows\b/i.test(lower) ||
      /\bshe'?s\s+telling\s+(?:him|ryan|her)\s+she\s+already\s+knows\b/i.test(lower) ||
      /\bshe\s+already\s+knows\s+(?:that\s+)?(?:he|ryan)\s+won'?t\b/i.test(lower) ||
      /\balready\s+knows\s+(?:he|ryan)\s+won'?t\b/i.test(lower));
  if (emmaClosingRhetoricNamed) {
    return { skip: true, reason: 'register_addressed' };
  }

  /** Condition 2 — register of the line (lexicon + closing-line engagement, or explicit deeper-than-frustration phrases). */
  const registerLexicon =
    /\b(sarcasm|sarcastic|passive[- ]aggressive|sharp(?:ness)?|resigned|resignation|bitter|contemptuous|cutting|dismissive|cold|loaded|pointed|snide|condescend(?:ing)?)\b/i;
  const interpretiveCueForClosingLine =
    /\b(what\s+she\s+meant|what\s+emma\s+meant|what\s+emma\s+was\s+(getting\s+at|trying\s+to\s+say)|she\s+meant|when\s+she\s+said|she\s+was\s+basically\s+saying|emma'?s\s+point\s+was|that\s+(line|statement|comment|response|remark|phrase|phrasing)|the\s+subtext\s+was|the\s+undertone\s+was|the\s+way\s+she\s+said|the\s+way\s+that\s+landed|that\s+came\s+across\s+as|it\s+landed\s+as|tone|that\s+comment\s+from\s+emma|emma'?s\s+(response|wording)\s+there)\b/.test(
      lower,
    );
  /** Bare "Emma + condescending" in a general Q1 answer is not enough — must tie register to the closing line. */
  const engagesEmmaClosingLineSpecifically =
    userReferencesEmmaClosingLineQuote(t) ||
    (lower.includes('very clear') && /\bemma\b/.test(lower)) ||
    /\b(that\s+line|that\s+comment|what\s+she\s+said|final\s+line|last\s+thing\s+she|when\s+she\s+says|that\s+last\s+thing|closing\s+line)\b/i.test(
      lower,
    ) ||
    (/\bemma\b/.test(lower) && interpretiveCueForClosingLine);
  const deeperThanSurfaceFrustration =
    /\bshe'?s\s+given\s+up\b/i.test(lower) ||
    /\bgiven\s+up\s+on\b/i.test(lower) ||
    /\bresignation\b/i.test(lower) ||
    /\bstopped\s+expecting\b/i.test(lower) ||
    /\bshe'?s\s+shutting\s+down\b/i.test(lower) ||
    (onScenarioATopic && /\b(a\s+)?shutdown\b/i.test(lower)) ||
    /\bwriting\s+him\s+off\b/i.test(lower) ||
    /\b(not\s+just\s+frustration|that'?s\s+not\s+just\s+frustration)\b/i.test(lower) ||
    /\bgo(es)?\s+deeper\s+than\s+tonight\b/i.test(lower) ||
    /\bshe'?s\s+being\s+passive[- ]aggressive\b/i.test(lower) ||
    /\bthat'?s\s+a\s+sarcastic\s+comment\b/i.test(lower) ||
    /\bshe'?s\s+making\s+a\s+dig\b/i.test(lower) ||
    /\bthat'?s\s+contempt\b/i.test(lower);

  if (deeperThanSurfaceFrustration) {
    return { skip: true, reason: 'register_addressed' };
  }
  if (registerLexicon.test(lower) && engagesEmmaClosingLineSpecifically) {
    return { skip: true, reason: 'register_addressed' };
  }

  /** Condition 3 — pattern interpretation tied to that specific line / comment. */
  const patternTiedToLine =
    (/\bsaid\s+this\s+before\b/i.test(lower) && /\bnothing\s+changed\b/i.test(lower)) ||
    /\bclearly\s+said\s+this\s+before\b/i.test(lower) ||
    /\bisn'?t\s+just\s+about\s+tonight\b/i.test(lower) ||
    /\bthat\s+line\s+shows\b/i.test(lower) ||
    /\bshe'?s\s+resigned\s+to\s+it\b/i.test(lower) ||
    /\bthat\s+comment\s+is\s+about\s+more\s+than\b/i.test(lower) ||
    (/\bthat\s+line\b/i.test(lower) &&
      /\b(shutdown|not\s+(?:just\s+)?(?:a\s+)?complaint|resigned|dismissive|closing|sarcastic|sting)\b/i.test(
        lower,
      ));

  if (patternTiedToLine) {
    return { skip: true, reason: 'pattern_interpretation_tied_to_line' };
  }

  return { skip: false, reason: null };
}

/**
 * Scenario A Q1: user already showed a **contempt-quality** read of Emma's "you've made that very clear" line —
 * hostile, dismissive, verdict-issuing, or relationally closing — not mere indirectness or minimization.
 *
 * Does **not** skip the probe for: passive-aggressive-only, "stating a fact," "just upset/venting," or
 * Emma's hurt without a dismissive/hostile read of that line. Long Ryan-only answers never qualify.
 */
export function hasScenarioAQ1ContemptProbeCoverage(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 10) return false;
  if (!SCENARIO_A_TOPIC_RE.test(t)) return false;
  const lower = normalizeScenarioAThatLineAsrTypos(
    normalizeInterviewApostrophesForMatching(t),
  )
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const hasInterpretiveCue =
    /\b(what\s+she\s+meant|what\s+emma\s+meant|what\s+emma\s+was\s+(getting\s+at|trying\s+to\s+say)|she\s+meant|when\s+she\s+said|she\s+was\s+basically\s+saying|emma'?s\s+point\s+was|that\s+(line|statement|comment|response|remark|phrase|phrasing)|the\s+subtext\s+was|the\s+undertone\s+was|the\s+way\s+she\s+said|the\s+way\s+that\s+landed|that\s+came\s+across\s+as|it\s+landed\s+as|tone|that\s+comment\s+from\s+emma|emma'?s\s+(response|wording)\s+there)\b/.test(
      lower
    );
  const referencesEmmaClosingRhetoric =
    /\bshe'?s\s+not\s+asking\s+(?:him|ryan|her)\s+to\s+stop\b/i.test(lower) ||
    /\bshe\s+isn'?t\s+asking\s+(?:him|ryan|her)\s+to\s+stop\b/i.test(lower) ||
    /\btelling\s+(?:him|ryan|her)\s+she\s+already\s+knows\b/i.test(lower) ||
    /\bshe'?s\s+telling\s+(?:him|ryan|her)\s+she\s+already\s+knows\b/i.test(lower) ||
    /\bshe\s+already\s+knows\s+(?:that\s+)?(?:he|ryan)\s+won'?t\b/i.test(lower) ||
    /\balready\s+knows\s+(?:he|ryan)\s+won'?t\b/i.test(lower);
  const referencesEmmaFinalLine =
    userReferencesEmmaClosingLineQuote(t) ||
    (lower.includes('very clear') && /\bemma\b/.test(lower)) ||
    (/\bemma\b/.test(lower) && hasInterpretiveCue) ||
    (/\b(emma|ryan)\b/.test(lower) && referencesEmmaClosingRhetoric);

  /** Hostile / verdict / relational-sting reads — not indirectness alone (see passive-aggressive rule below). */
  const hasStrongContemptQualityRead =
    /\b(cont(empt|emptuous)|harsh|cutting|dismissive|dismissed|cold|biting|sarcastic|verdict|mean|punitive|punish(es|ing)?|shut(ting)?\s+down|shutdown|clos(e|ing|es)?\s+off|clos(es|ing)?\s+the\s+door|door[- ]?clos|last\s+word|finality|superior|condescend|condescending|derogat|belittl|scathing|hostile|demean|degrad|mock|mockery|sting|walling|stonewall|jab|dig|put[- ]?down|swipe|loaded|taking\s+a\s+shot)\b/i.test(
      lower
    );
  /** Substantive interpretive read of the line's relational meaning even without explicit contempt adjectives. */
  const hasSubstantiveInterpretiveRead =
    /\b(accumulated\s+frustration|built[- ]?up\s+frustration|established\s+behavior|not\s+an\s+isolated\s+incident|current\s+pattern|for\s+some\s+time|for\s+a\s+while|tolerated\s+for\s+some\s+time|response\s+to\s+established\s+behavior|prioritiz(?:e|es|ing)\s+(his|her|their)\s+family)\b/i.test(
      lower
    );

  const hasPassiveAggressive = /\bpassive[- ]aggressive\b/i.test(lower);
  /** PA names delivery style, not necessarily contempt — insufficient alone to skip the probe. */
  const onlyPassiveAggressive = hasPassiveAggressive && !hasStrongContemptQualityRead;

  const minimizesEmmaLineRead =
    /\b(just\s+)?stating\s+a\s+fact\b|\bemma\s+is\s+just\s+stating\b|\bjust\s+(upset|venting)\b|\bonly\s+(saying|stating)\s+a\s+fact\b/i.test(
      lower
    );

  /** Named Emma/Ryan + explicit read of Emma's closing move — sufficient without contempt adjectives (e.g. "won't change"). */
  if (/\b(emma|ryan)\b/.test(lower) && referencesEmmaClosingRhetoric) {
    if (onlyPassiveAggressive) return false;
    if (minimizesEmmaLineRead && !hasStrongContemptQualityRead) return false;
    return true;
  }

  if (!referencesEmmaFinalLine) return false;
  if (onlyPassiveAggressive) return false;
  if (minimizesEmmaLineRead && !hasStrongContemptQualityRead) return false;

  return hasStrongContemptQualityRead || hasSubstantiveInterpretiveRead;
}

export function debugScenarioAQ1ContemptProbeCoverageDetail(text: string): {
  normalizedLength: number;
  hasScenarioATopic: boolean;
  hasInterpretiveCue: boolean;
  referencesEmmaClosingRhetoric: boolean;
  referencesEmmaFinalLine: boolean;
  hasStrongContemptQualityRead: boolean;
  hasSubstantiveInterpretiveRead: boolean;
  hasPassiveAggressive: boolean;
  onlyPassiveAggressive: boolean;
  minimizesEmmaLineRead: boolean;
  coverage: boolean;
} {
  const t = text.replace(/\s+/g, ' ').trim();
  const hasScenarioATopic = SCENARIO_A_TOPIC_RE.test(t);
  const lower = normalizeScenarioAThatLineAsrTypos(
    normalizeInterviewApostrophesForMatching(t),
  )
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const hasInterpretiveCue =
    /\b(what\s+she\s+meant|what\s+emma\s+was\s+(getting\s+at|trying\s+to\s+say)|she\s+meant|when\s+she\s+said|she\s+was\s+basically\s+saying|emma'?s\s+point\s+was|that\s+(line|statement|comment|response|remark|phrase|phrasing)|the\s+subtext\s+was|the\s+undertone\s+was|the\s+way\s+she\s+said|the\s+way\s+that\s+landed|that\s+came\s+across\s+as|it\s+landed\s+as|tone|that\s+comment\s+from\s+emma|emma'?s\s+(response|wording)\s+there)\b/.test(
      lower
    );
  const referencesEmmaClosingRhetoric =
    /\bshe'?s\s+not\s+asking\s+(?:him|ryan|her)\s+to\s+stop\b/i.test(lower) ||
    /\bshe\s+isn'?t\s+asking\s+(?:him|ryan|her)\s+to\s+stop\b/i.test(lower) ||
    /\btelling\s+(?:him|ryan|her)\s+she\s+already\s+knows\b/i.test(lower) ||
    /\bshe'?s\s+telling\s+(?:him|ryan|her)\s+she\s+already\s+knows\b/i.test(lower) ||
    /\bshe\s+already\s+knows\s+(?:that\s+)?(?:he|ryan)\s+won'?t\b/i.test(lower) ||
    /\balready\s+knows\s+(?:he|ryan)\s+won'?t\b/i.test(lower);
  const referencesEmmaFinalLine =
    userReferencesEmmaClosingLineQuote(t) ||
    (lower.includes('very clear') && /\bemma\b/.test(lower)) ||
    (/\bemma\b/.test(lower) && hasInterpretiveCue) ||
    (/\b(emma|ryan)\b/.test(lower) && referencesEmmaClosingRhetoric);
  const hasStrongContemptQualityRead =
    /\b(cont(empt|emptuous)|harsh|cutting|dismissive|dismissed|cold|biting|sarcastic|verdict|mean|punitive|punish(es|ing)?|shut(ting)?\s+down|shutdown|clos(e|ing|es)?\s+off|clos(es|ing)?\s+the\s+door|door[- ]?clos|last\s+word|finality|superior|condescend|condescending|derogat|belittl|scathing|hostile|demean|degrad|mock|mockery|sting|walling|stonewall|jab|dig|put[- ]?down|swipe|loaded|taking\s+a\s+shot)\b/i.test(
      lower
    );
  const hasSubstantiveInterpretiveRead =
    /\b(accumulated\s+frustration|built[- ]?up\s+frustration|established\s+behavior|not\s+an\s+isolated\s+incident|current\s+pattern|for\s+some\s+time|for\s+a\s+while|tolerated\s+for\s+some\s+time|response\s+to\s+established\s+behavior|prioritiz(?:e|es|ing)\s+(his|her|their)\s+family)\b/i.test(
      lower
    );
  const hasPassiveAggressive = /\bpassive[- ]aggressive\b/i.test(lower);
  const onlyPassiveAggressive = hasPassiveAggressive && !hasStrongContemptQualityRead;
  const minimizesEmmaLineRead =
    /\b(just\s+)?stating\s+a\s+fact\b|\bemma\s+is\s+just\s+stating\b|\bjust\s+(upset|venting)\b|\bonly\s+(saying|stating)\s+a\s+fact\b/i.test(
      lower
    );

  return {
    normalizedLength: t.length,
    hasScenarioATopic,
    hasInterpretiveCue,
    referencesEmmaClosingRhetoric,
    referencesEmmaFinalLine,
    hasStrongContemptQualityRead,
    hasSubstantiveInterpretiveRead,
    hasPassiveAggressive,
    onlyPassiveAggressive,
    minimizesEmmaLineRead,
    coverage: hasScenarioAQ1ContemptProbeCoverage(text),
  };
}

/**
 * Scenario A Q1: broad on-topic engagement (e.g. scoring / analytics). Includes long answers that
 * only center Ryan — use {@link hasScenarioAQ1ContemptProbeCoverage} to decide contempt-probe forcing.
 */
export function hasScenarioAQ1VignetteEngagement(text: string): boolean {
  if (hasScenarioAQ1ContemptProbeCoverage(text)) return true;
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 10) return false;
  if (!SCENARIO_A_TOPIC_RE.test(t)) return false;
  return t.length >= 28;
}

function normalizeScenarioAQ1PromptMatchText(text: string): string {
  return text.replace(/\u2019/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
}

function isScenarioAQ1OpeningPromptText(text: string): boolean {
  return normalizeScenarioAQ1PromptMatchText(text).includes("what's going on between these two");
}

function isScenarioAVignetteOnlyAssistantText(text: string): boolean {
  const t = normalizeScenarioAQ1PromptMatchText(text);
  if (!t || isScenarioAQ1OpeningPromptText(text)) return false;
  return t.includes('emma and ryan') || t.includes('ryan takes a call from his mother');
}

function isResumeWelcomeBackAssistantText(text: string): boolean {
  const t = normalizeScenarioAQ1PromptMatchText(text);
  return t.includes('welcome back') && t.includes('pick up where we left off');
}

/** Brief Scenario A acknowledgment/reflection after Q1 — contempt probe not yet delivered. */
function isScenarioAPreContemptAssistantReflection(text: string): boolean {
  const t = normalizeScenarioAQ1PromptMatchText(text);
  if (!t) return false;
  if (isScenarioAQ1OpeningPromptText(text)) return false;
  if (isScenarioAVignetteOnlyAssistantText(text)) return false;
  if (isResumeWelcomeBackAssistantText(text)) return false;
  if (looksLikeScenarioAContemptProbeQuestion(text)) return false;
  if (
    t.includes('how would you repair this relationship if you were ryan') ||
    (/\b(if you were ryan|you were ryan)\b/.test(t) && /\brepair\b/.test(t))
  ) {
    return false;
  }
  return /\b(emma|ryan)\b/.test(t);
}

/**
 * True when the user's turn is a substantive Scenario A Q1 answer — including after resume when
 * the last stored assistant line is welcome-back or vignette-only (Q1 may have been spoken via TTS only).
 */
export function isReplyingToScenarioAQ1AfterDelivery(params: {
  currentMoment: number;
  contemptProbeAlreadyAsked: boolean;
  lastAssistantWasContemptProbe: boolean;
  lastAssistantWasRepair: boolean;
  assistantTexts: string[];
  userAnswerText: string;
}): boolean {
  if (params.currentMoment !== 1) return false;
  if (params.contemptProbeAlreadyAsked) return false;
  if (params.lastAssistantWasContemptProbe || params.lastAssistantWasRepair) return false;

  const texts = params.assistantTexts.map((t) => (t ?? '').trim()).filter(Boolean);
  if (texts.some(isScenarioAQ1OpeningPromptText)) return true;

  const resumeOrVignetteContext = texts.some(
    (t) => isScenarioAVignetteOnlyAssistantText(t) || isResumeWelcomeBackAssistantText(t)
  );
  const preContemptReflectionContext = texts.some(isScenarioAPreContemptAssistantReflection);
  return (
    (resumeOrVignetteContext || preContemptReflectionContext) &&
    hasScenarioAQ1VignetteEngagement(params.userAnswerText)
  );
}

/** Debug/instrumentation: which Scenario C commitment-threshold regex bucket matched (if any). */
export function scenarioCCommitmentThresholdMatchDetail(text: string): {
  irrecoverable: boolean;
  relationshipOutcome: boolean;
  decisionProcess: boolean;
} {
  const t = text.replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 12) return { irrecoverable: false, relationshipOutcome: false, decisionProcess: false };
  const irrecoverable =
    /\b(irrecover|unworkable|incompatib|deal[- ]?breaker|isn't working|isnt working|is not working|relationship is not working|not worth (it|continuing)|should (end|split)|break up|breakup|divorce|call it quits|done with (the relationship|them|him|her))\b/.test(
      t
    );
  const relationshipOutcome =
    /\b(walk away from (the relationship|it all|them|him|her)|leave (for good|the relationship)|end things|end(ing)? the relationship|leave them for good|time to go|split up|separate for good)\b/.test(
      t
    );
  const decisionProcess =
    /\b(at what point (would|do) (you|they|i|we)|when (i|we) would (end|leave|quit)|when to (end|leave|call it)|before (i|we) give up|last straw|line in the sand|non[- ]?negotiable|if (it|they) keeps? happening|this pattern keeps? happening|pattern keeps? happening|pattern (never|doesn't|does not) change|after (multiple|repeated)|years of the same)\b/.test(
      t
    );
  return { irrecoverable, relationshipOutcome, decisionProcess };
}

/**
 * Scenario C: true only when the user named relationship-level exit / unworkability criteria — not vignette motion
 * alone ("Daniel leaves", "walk away" from the room) or generic repair language.
 */
export function hasScenarioCCommitmentThresholdInUserAnswer(text: string): boolean {
  const f = scenarioCCommitmentThresholdMatchDetail(text);
  return f.irrecoverable || f.relationshipOutcome || f.decisionProcess;
}

/**
 * Threshold-style language **and** Daniel/Sophie named — satisfies the scripted Scenario C commitment probe.
 * Repair-only answers ("they're incompatible") without naming the characters do **not** skip forcing the question.
 */
export function hasScenarioCVignetteCommitmentThresholdSignal(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 12) return false;
  if (!/\b(daniel|sophie)\b/i.test(t)) return false;
  return hasScenarioCCommitmentThresholdInUserAnswer(t);
}

/**
 * Assistant turn: Scenario C Q2 (repair) — not Q1 (make of Daniel's "I didn't know what to say" line), not commitment threshold.
 * Models paraphrase; keep in sync with AriaScreen `replyingToScenarioCQ2` / forced threshold injection.
 */
export function isScenarioCRepairAssistantPrompt(text: string): boolean {
  const raw = normalizeInterviewTypography(text ?? '');
  const t = raw.replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 22) return false;
  if (looksLikeScenarioCCommitmentThresholdAssistantPrompt(raw)) return false;
  if (isScenarioCQ1Prompt(raw)) return false;
  const canonical = t.includes('how do you think this situation could be repaired');
  const dropSituation = /\bhow do you think this could be repaired\b/.test(t);
  const modalShort =
    /\bhow (might|could|would|should) this situation be repaired\b/.test(t) ||
    /\bhow (might|could|would) this be repaired\b/.test(t);
  const canBeRepaired =
    /\bhow (can|could) (this situation|this|they|things) be repaired\b/.test(t) ||
    /\bhow (can|could) (they|daniel and sophie) repair\b/.test(t);
  const repairIng =
    /\bhow would you (approach|begin) repair(ing)?\b/.test(t) ||
    /\bhow (might|should) (they|the couple) repair\b/.test(t);
  return canonical || dropSituation || modalShort || canBeRepaired || repairIng;
}

/**
 * True when assistant text embeds the canonical scripted Scenario C commitment-threshold line
 * (client inject or model). Used to avoid duplicate forces, resume false negatives, and races
 * before `scenarioCCommitmentThresholdProbeAskedRef` flips.
 */
export function assistantContainsScenarioCCommitmentThresholdForcedLine(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '')
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (t.length < 50) return false;
  if (!t.includes('at what point would you say daniel or sophie should decide')) return false;
  return (
    t.includes("this relationship isn't working") ||
    t.includes('this relationship is not working') ||
    (t.includes('relationship') && (/\bisn'?t working\b/.test(t) || /\bis not working\b/.test(t)))
  );
}

/** Scenario C follow-up: when Daniel/Sophie should decide the relationship is not working (not the repair prompt). */
export function looksLikeScenarioCCommitmentThresholdAssistantPrompt(text: string): boolean {
  if (assistantContainsScenarioCCommitmentThresholdForcedLine(text)) return true;
  const raw = normalizeInterviewTypography(text ?? '');
  const t = raw.replace(/\u2019/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 24) return false;
  if (!/\bdaniel\b/.test(t) || !/\bsophie\b/.test(t)) return false;

  const relationshipBroken =
    t.includes("this relationship isn't working") ||
    t.includes('this relationship is not working') ||
    t.includes("relationship isn't working") ||
    t.includes('relationship is not working') ||
    /\b(isn'?t|is not)\s+working\b/.test(t) ||
    (/\brelationship\b/.test(t) && /\bnot working\b/.test(t));

  if (!relationshipBroken) return false;

  const canonical =
    t.includes('at what point would you say daniel or sophie should decide this relationship') ||
    t.includes("at what point would you say daniel or sophie should decide this relationship isn't working");

  const pointAsk = /\b(at what point|what point)\b/.test(t);
  const framedAsk =
    pointAsk &&
    (/\bwould you say\b/.test(t) || /\bdo you decide\b/.test(t)) &&
    (/\bshould decide\b/.test(t) || /\brelationship\b/.test(t));
  /** e.g. "At what point would you decide Sophie and Daniel's relationship isn't working?" — models omit "say" / "should". */
  const wouldYouDecideBothNamed =
    pointAsk &&
    /\bwould you decide\b/.test(t) &&
    /\bdaniel\b/.test(t) &&
    /\bsophie\b/.test(t) &&
    relationshipBroken;

  return Boolean(canonical || framedAsk || wouldYouDecideBothNamed);
}

/**
 * Assistant turn that pivots from fictional Scenario C to personal Moment 4 (grudge / dislike).
 * Production still tags post-handoff messages as `scenarioNumber: 3`, so scoring must cut here.
 */
export function isScenarioCToPersonalHandoffAssistantContent(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const grudgeOrDislike =
    t.includes('held a grudge') ||
    (t.includes("really didn't like") && /\b(someone|your life|people)\b/.test(t)) ||
    (t.includes('really hard time with') && t.includes('what happened')) ||
    (t.includes('got under your skin') && t.includes('what happened'));
  if (!grudgeOrDislike) return false;
  return (
    t.includes('three situations') ||
    t.includes("we've finished") ||
    t.includes('finished the three') ||
    t.includes('last two questions') ||
    t.includes('two questions are more personal') ||
    t.includes('only two questions') ||
    (t.includes('good work') && t.includes('three situations'))
  );
}

/** Mirrors {@link assistantTextLooksLikeMoment4HandoffLead} without importing interviewTransitionBundles (cycle). */
function assistantTextLooksLikePersonalMomentStart(content: string): boolean {
  if (isScenarioCToPersonalHandoffAssistantContent(content)) return true;
  if (looksLikeMoment4GrudgePrompt(content)) return true;
  if (isMoment5AssistantAnchor(content)) return true;
  const t = normalizeInterviewTypography(content ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (/held a grudge|really didn't like/.test(t)) return true;
  if (/really hard time with|got under your skin/.test(t)) return true;
  if (/finished the three situations/.test(t)) return true;
  if (/end of (the )?three (situations|described situations|vignettes)/.test(t)) return true;
  if (/done with those three scenarios?/.test(t)) return true;
  if (t.includes('three situations') && (t.includes('two questions') || t.includes('more about you'))) {
    return true;
  }
  if (t.includes("we're done with those three") || t.includes('done with those three')) return true;
  return false;
}

type Scenario3ScoringTurn = { role: string; content?: string; interviewMoment?: number };

/**
 * Fiction-only Scenario C band for scoring — cuts before Moment 4/5 assistant handoffs and drops
 * turns tagged `interviewMoment` ≥ 4 (personal moments still carry `scenarioNumber: 3` in production).
 */
export function sliceTranscriptForScenario3Scoring<T extends Scenario3ScoringTurn>(
  transcript: readonly T[],
): T[] {
  let cut = transcript.length;
  for (let i = 0; i < transcript.length; i++) {
    const m = transcript[i];
    if (m.role !== 'assistant') continue;
    const content = typeof m.content === 'string' ? m.content : '';
    if (
      (typeof m.interviewMoment === 'number' && m.interviewMoment >= 4) ||
      assistantTextLooksLikePersonalMomentStart(content)
    ) {
      cut = i;
      break;
    }
  }
  return transcript.slice(0, cut).filter((m) => {
    const im = m.interviewMoment;
    return im === undefined || im <= 3;
  }) as T[];
}

/** Drop assistant + user turns from personal Moment 4 onward — keeps Scenario C slice fiction-only. */
export function sliceTranscriptBeforeScenarioCToPersonalHandoff<
  T extends { role: string; content?: string },
>(transcript: readonly T[]): T[] {
  return sliceTranscriptForScenario3Scoring(transcript);
}

export type ScenarioCorpusMessageSlice = {
  role: string;
  content?: string;
  scenarioNumber?: number | null;
};

/**
 * User answer(s) to the Scenario C **repair** question only — stops before the commitment-threshold
 * assistant turn so the repair answer is never concatenated with the threshold follow-up (scoring
 * and probe logic must stay independent).
 */
export function extractScenario3UserCorpusAfterLastRepairPrompt(
  msgs: readonly ScenarioCorpusMessageSlice[],
): string {
  const scoped = sliceTranscriptForScenario3Scoring(msgs);
  let lastRepairIdx = -1;
  for (let i = scoped.length - 1; i >= 0; i--) {
    const m = scoped[i];
    if (m.role === 'assistant' && typeof m.content === 'string' && isScenarioCRepairAssistantPrompt(m.content)) {
      lastRepairIdx = i;
      break;
    }
  }
  if (lastRepairIdx < 0) return '';
  const parts: string[] = [];
  for (let i = lastRepairIdx + 1; i < scoped.length; i++) {
    const m = scoped[i];
    if (m.role === 'assistant' && m.scenarioNumber === 3 && typeof m.content === 'string') {
      if (looksLikeScenarioCCommitmentThresholdAssistantPrompt(m.content)) break;
      continue;
    }
    if (m.role === 'user' && m.scenarioNumber === 3) {
      const t = String(m.content ?? '').trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(' ');
}

/**
 * User answer(s) in Scenario C **before** the general repair assistant prompt — unprompted relative to
 * "How do you think this situation could be repaired?" (typically Q1 and any prior user turns in this scenario).
 */
export function extractScenario3UserCorpusBeforeRepairPrompt(
  msgs: readonly ScenarioCorpusMessageSlice[],
): string {
  const scoped = sliceTranscriptForScenario3Scoring(msgs);
  let lastRepairIdx = -1;
  for (let i = scoped.length - 1; i >= 0; i--) {
    const m = scoped[i];
    if (m.role === 'assistant' && typeof m.content === 'string' && isScenarioCRepairAssistantPrompt(m.content)) {
      lastRepairIdx = i;
      break;
    }
  }
  if (lastRepairIdx < 0) return '';
  const parts: string[] = [];
  for (let i = 0; i < lastRepairIdx; i++) {
    const m = scoped[i];
    if (m.role === 'user' && m.scenarioNumber === 3) {
      const t = String(m.content ?? '').trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(' ');
}

/** User answer(s) to the Scenario C commitment-threshold follow-up only (Daniel/Sophie), for sole-source scoring. */
export function extractScenario3CommitmentThresholdUserAnswerAfterPrompt(
  msgs: readonly ScenarioCorpusMessageSlice[],
): string {
  const scoped = sliceTranscriptForScenario3Scoring(msgs);
  let threshIdx = -1;
  for (let i = 0; i < scoped.length; i++) {
    const m = scoped[i];
    if (
      m.role === 'assistant' &&
      m.scenarioNumber === 3 &&
      typeof m.content === 'string' &&
      looksLikeScenarioCCommitmentThresholdAssistantPrompt(m.content)
    ) {
      threshIdx = i;
      break;
    }
  }
  if (threshIdx < 0) return '';
  const parts: string[] = [];
  for (let i = threshIdx + 1; i < scoped.length; i++) {
    const m = scoped[i];
    if (m.role === 'assistant') break;
    if (m.role === 'user' && m.scenarioNumber === 3) {
      const t = String(m.content ?? '').trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(' ');
}

/** Moment 4: a personal grudge answer with any narrative substance — used for scoring helpers, not to gate the threshold probe. */
export function hasMoment4PersonalNarrativeEngagement(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 25) return false;
  return /\b(i|my|me|we|our|us)\b/i.test(t);
}

/** Curly / typographic apostrophes and quotes → ASCII so string checks match model output. */
export function normalizeInterviewTypography(text: string): string {
  return text
    .replace(/\u2018|\u2019|\u201b/g, "'")
    .replace(/\u201c|\u201d/g, '"');
}

export function isLikelyMisplacedPersonalNarrativeForScenarioCThreshold(text: string): boolean {
  /**
   * Answers that already express commitment / exit timing (e.g. "third time… end the relationship")
   * often omit "Daniel/Sophie/their" — must not be treated as misplaced personal Moment-4 narrative
   * (session_logs: SC3_MISPLACED_THRESHOLD_SEQUENCE after threshold probe + whisper "end the relationship").
   */
  if (hasScenarioCCommitmentThresholdInUserAnswer(text)) return false;
  const t = text.toLowerCase();
  /**
   * Third-person about the vignette couple often uses "their relationship" / "them" — not `\bthey\b`.
   * Misclassifying that as a personal Moment-4 narrative re-fires the redirect + threshold TTS loop (see SC3_MISPLACED_THRESHOLD_SEQUENCE).
   */
  const referencesScenarioCharacters =
    /\b(daniel|sophie|they|their|them)\b/.test(t) &&
    /\b(should|would|relationship|not working|walk away|end|ending|fight|fighting|couple|together)\b/.test(t);
  if (referencesScenarioCharacters) return false;
  const hasPersonalNarrativeSignals =
    /\b(i|my|me|we|our|us)\b/.test(t) &&
    /\b(ex|relationship|partner|wife|husband|boyfriend|girlfriend|friend|family|when i|i had|i was|i felt|i decided|i left|i stayed)\b/.test(
      t
    );
  return hasPersonalNarrativeSignals;
}

/** True when the assistant turn is Scenario C Q1 (interpret Daniel's line), not Q2/repair/threshold. */
export function isScenarioCQ1Prompt(text: string): boolean {
  const t = normalizeInterviewTypography(text).replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 12) return false;
  if (/\bhow do you think this situation could be repaired\b/.test(t)) return false;
  if (/\bat what point would you say daniel or sophie\b/.test(t)) return false;
  if (t.includes("isn't working") && t.includes('daniel') && t.includes('sophie')) return false;
  const quotesDanielReturnLine =
    t.includes("didn't know what to say") ||
    t.includes('did not know what to say') ||
    t.includes("didn't know how") ||
    t.includes('did not know how');
  return t.includes('what do you make of') && quotesDanielReturnLine;
}

/**
 * User answered Q1 with repair/logistics/next-steps rather than interpreting Daniel's internal state
 * or the meaning of his return line ("I didn't know what to say"; legacy transcripts may say "I didn't know how").
 */
export function isMisplacedScenarioCQ1Answer(text: string): boolean {
  const t = normalizeInterviewTypography(text).replace(/\s+/g, ' ').trim();
  if (t.length < 40) return false;

  /** User engaged the quoted prompt line or a clear "what that line means" read — not only prescriptions. */
  const referencesDanielPromptLine =
    /\b(i |he |she |they )?didn'?t know what to say\b/i.test(t) ||
    /\b(i |he |she |they )?didn'?t know how\b/i.test(t) ||
    /\bwhat (that |he |daniel )?(line|said|means?|meant)\b/i.test(t) ||
    /\bwhen (daniel |he )(comes back |says|said )\b/i.test(t) ||
    /\b(that|those) words\b/i.test(t);

  const danielInternalRead =
    /\b(daniel|he)('?s| is| was| felt| seems| sounds| means| meant)\b/i.test(t) ||
    /\b(his|him) (own|inner|shame|fear|anxiety|avoidance|struggle|vulnerability|emotion|state|head|heart)\b/i.test(
      t
    ) ||
    /\b(meaning|read|interpretation) (of|is|that)|what (that|he) mean|what (that|it) (says|tells|signals|shows)\b/i.test(
      t
    ) ||
    /\b(where he'?s at|what he'?s going through|going on (for|with) him|in his (shoes|position))\b/i.test(t) ||
    /\b(overwhelmed|ashamed|embarrassed|stuck|lost|flooded|shut down|shutdown|vulnerable|raw|defensive|avoidant|withdraw|withdrawing)\b/i.test(
      t
    ) ||
    /\b(didn'?t know what to say|didn'?t know how (to|what)|lack(ed|s)? (the )?(skills|tools|words)|capacity|limitation|learning|growth|trying|effort|intent)\b/i.test(
      t
    ) ||
    /\b(remorse|guilt|shame)\b/i.test(t);

  if (danielInternalRead) return false;

  const prescriptiveDanielSophie =
    /\b(daniel|sophie)\s+(needs? to|has to|must)\b/i.test(t) || /\bdaniel should\b/i.test(t);

  const relationshipVerdictOrThreshold =
    /\b(relationship (is )?(not )?working|whether (this |the )?relationship|walk away|end (the relationship|it)|seriously consider|fourth time|third time|one more time|without real change|deal[- ]?breaker)\b/i.test(
      t
    );

  if (!referencesDanielPromptLine && (prescriptiveDanielSophie || relationshipVerdictOrThreshold)) {
    return true;
  }

  const logisticsOrRepairNextSteps =
    /\b(they should|the couple (should|needs to)|both (need|should) to|sophie and daniel should|next step|action plan|ground rules|start by|begin by|sit down (and|to)|schedule|couples therapy|therapy|mediat|take turns|check[- ]?ins?\b|communicate better|talk it out|work (it|this) out|resolve (this|it)|repair (this|the|their)|how (they|we) (could|should|can) (fix|repair|handle)|patch things|make a plan|come up with|agree on|structure|boundar(y|ies))\b/i.test(
      t
    );

  return logisticsOrRepairNextSteps;
}
