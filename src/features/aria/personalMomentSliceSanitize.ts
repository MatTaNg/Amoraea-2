/** Minimal slice shape after personal-moment LLM scoring (before DB/aggregate). */
export type PersonalMomentSliceForSanitize = {
  momentNumber?: 4;
  pillarScores: Record<string, number | null>;
  pillarConfidence?: Record<string, string>;
  keyEvidence?: Record<string, string>;
  summary?: string;
  specificity?: string;
  momentName?: string;
};

const M4_REMOVE: readonly string[] = [
  'repair',
  'attunement',
  'appreciation',
  'regulation',
];

const M5_REMOVE: readonly string[] = [
  'commitment_threshold',
  'appreciation',
  'attunement',
  'contempt_recognition',
  'contempt',
];

/**
 * Personal-moment prompts score only listed constructs; strip anything else the model echoes
 * so aggregates and stored JSON cannot leak e.g. Moment 4 `repair` into pillar math or admin views.
 */
export function sanitizePersonalMomentScoresForAggregate(
  scored: PersonalMomentSliceForSanitize | null
): PersonalMomentSliceForSanitize | null {
  if (!scored?.pillarScores) return scored;
  const pillarScores = { ...scored.pillarScores };
  const keyEvidence = { ...(scored.keyEvidence ?? {}) };
  const removeLc = new Set(M4_REMOVE.map((k) => k.toLowerCase()));
  for (const k of Object.keys(pillarScores)) {
    if (removeLc.has(k.toLowerCase())) delete pillarScores[k];
  }
  for (const k of Object.keys(keyEvidence)) {
    if (removeLc.has(k.toLowerCase())) delete keyEvidence[k];
  }
  return { ...scored, pillarScores, keyEvidence };
}

export type PersonalMoment5SliceForSanitize = {
  momentNumber?: 5;
  pillarScores: Record<string, number | null>;
  pillarConfidence?: Record<string, string>;
  keyEvidence?: Record<string, string>;
  summary?: string;
  specificity?: string;
  momentName?: string;
};

/**
 * Moment 5 prompts ask for `contempt_expression`, but models sometimes emit legacy monolithic `contempt`.
 * Aggregation and contempt pooling read `contempt_expression`; sanitization used to strip `contempt` only,
 * leaving an empty pillar map. Promote before stripping removed keys (and call after parse in live scoring).
 */
export function promoteMoment5LegacyContemptForScoringResult(scored: {
  pillarScores?: Record<string, number | null | undefined> | null;
  keyEvidence?: Record<string, string> | null;
}): void {
  const ps = scored.pillarScores;
  if (!ps || typeof ps !== 'object') return;
  const legacy = ps.contempt;
  if (ps.contempt_expression != null) return;
  if (typeof legacy !== 'number' || !Number.isFinite(legacy)) return;
  ps.contempt_expression = legacy;
  const ke = scored.keyEvidence ?? {};
  if (!ke.contempt_expression?.trim() && typeof ke.contempt === 'string' && ke.contempt.trim()) {
    scored.keyEvidence = { ...ke, contempt_expression: ke.contempt };
  }
}

/** Strip keys Moment 5 does not assess (matches live scoring prompt). */
export function sanitizeMoment5PersonalScoresForAggregate(
  scored: PersonalMoment5SliceForSanitize | null
): PersonalMoment5SliceForSanitize | null {
  if (!scored?.pillarScores) return scored;
  promoteMoment5LegacyContemptForScoringResult(scored);
  const pillarScores = { ...scored.pillarScores };
  const keyEvidence = { ...(scored.keyEvidence ?? {}) };
  const removeLc = new Set(M5_REMOVE.map((k) => k.toLowerCase()));
  for (const k of Object.keys(pillarScores)) {
    if (removeLc.has(k.toLowerCase())) delete pillarScores[k];
  }
  for (const k of Object.keys(keyEvidence)) {
    if (removeLc.has(k.toLowerCase())) delete keyEvidence[k];
  }
  return { ...scored, pillarScores, keyEvidence };
}
