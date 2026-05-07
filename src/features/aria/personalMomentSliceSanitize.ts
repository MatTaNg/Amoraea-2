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

/** Strip keys Moment 5 does not assess (matches live scoring prompt). */
export function sanitizeMoment5PersonalScoresForAggregate(
  scored: PersonalMoment5SliceForSanitize | null
): PersonalMoment5SliceForSanitize | null {
  if (!scored?.pillarScores) return scored;
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
