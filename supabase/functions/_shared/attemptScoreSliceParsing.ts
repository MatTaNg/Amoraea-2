/** Pure helpers for reading marker slices from `interview_attempts` JSON (shared + unit-tested). */

export type MarkerScoreSliceParsed = {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
  mentalizing_overcertainty?: boolean;
  response_concreteness?: string | null;
  user_slice_word_count?: number;
  emotional_vocab_count?: number;
  emotional_vocab_words?: string[];
};

export function sliceScoresFromAttemptField(raw: unknown): {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
} | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const ps = o.pillarScores ?? o.pillar_scores;
  const ke = o.keyEvidence ?? o.key_evidence;
  if (ps == null && ke == null) return null;
  return {
    pillarScores:
      typeof ps === 'object' && ps != null && !Array.isArray(ps) ? (ps as Record<string, number | null>) : undefined,
    keyEvidence:
      typeof ke === 'object' && ke != null && !Array.isArray(ke) ? (ke as Record<string, string>) : undefined,
  };
}

export function emotionalVocabWordsFromField(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const words = raw
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    .map((s) => s.trim());
  return words.length > 0 ? words : undefined;
}

export function markerSliceFromAttemptScoresField(raw: unknown): MarkerScoreSliceParsed | null {
  const base = sliceScoresFromAttemptField(raw);
  if (!base || raw == null || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  const mo = o.mentalizing_overcertainty;
  const w = o.user_slice_word_count;
  const evc = o.emotional_vocab_count;
  return {
    ...base,
    mentalizing_overcertainty: mo === true,
    response_concreteness:
      typeof o.response_concreteness === 'string'
        ? o.response_concreteness
        : typeof o.specificity === 'string'
          ? o.specificity
          : null,
    user_slice_word_count: typeof w === 'number' && Number.isFinite(w) && w >= 0 ? w : undefined,
    emotional_vocab_count:
      typeof evc === 'number' && Number.isFinite(evc) && evc >= 0 ? Math.floor(evc) : undefined,
    emotional_vocab_words: emotionalVocabWordsFromField(o.emotional_vocab_words),
  };
}

export function markerSlicesFromAttemptRow(row: {
  scenario_1_scores?: unknown;
  scenario_2_scores?: unknown;
  scenario_3_scores?: unknown;
  scenario_specific_patterns?: unknown;
}): Array<MarkerScoreSliceParsed | null> {
  const patterns = row.scenario_specific_patterns;
  const p =
    patterns != null && typeof patterns === 'object' && !Array.isArray(patterns)
      ? (patterns as Record<string, unknown>)
      : null;
  return [
    markerSliceFromAttemptScoresField(row.scenario_1_scores),
    markerSliceFromAttemptScoresField(row.scenario_2_scores),
    markerSliceFromAttemptScoresField(row.scenario_3_scores),
    markerSliceFromAttemptScoresField(p?.moment_4_scores),
    markerSliceFromAttemptScoresField(p?.moment_5_scores),
  ].map((s) => s ?? null);
}

export function finiteNumberOrNull(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && String(raw).trim() !== '') {
    const n = Number(String(raw).trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function pickPersistedNumber(primary: unknown, fallback: unknown): number | null {
  const p = finiteNumberOrNull(primary);
  if (p !== null) return p;
  return finiteNumberOrNull(fallback);
}

/** Shape written on interview completion (no legacy `gate_fail_reason`). */
export function buildInterviewAttemptGateCompletionFields(gate: {
  pass: boolean;
  weightedScore: number | null;
  failReasonCodes?: string[] | null;
  failReasonDetail?: unknown;
}): Record<string, unknown> {
  return {
    weighted_score: gate.weightedScore,
    passed: gate.pass,
    gate_fail_reasons: gate.failReasonCodes ?? [],
    gate_fail_detail: gate.failReasonDetail ?? null,
  };
}
