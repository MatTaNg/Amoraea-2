/** Minimal slice shape after personal-moment LLM scoring (before DB/aggregate). */
export type PersonalMomentSliceForSanitize = {
  momentNumber?: 4 | 5;
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
  'repair',
  'accountability',
  'commitment_threshold',
  'regulation',
  'contempt_recognition',
];

/**
 * Personal-moment prompts score only listed constructs; strip anything else the model echoes
 * so aggregates and stored JSON cannot leak e.g. Moment 4 `repair` into pillar math or admin views.
 */
export function sanitizePersonalMomentScoresForAggregate(
  scored: PersonalMomentSliceForSanitize | null,
  momentNumber: 4 | 5,
): PersonalMomentSliceForSanitize | null {
  if (!scored?.pillarScores) return scored;
  const remove = momentNumber === 4 ? M4_REMOVE : M5_REMOVE;
  const pillarScores = { ...scored.pillarScores };
  const keyEvidence = { ...(scored.keyEvidence ?? {}) };
  const removeLc = new Set(remove.map((k) => k.toLowerCase()));
  for (const k of Object.keys(pillarScores)) {
    if (removeLc.has(k.toLowerCase())) delete pillarScores[k];
  }
  for (const k of Object.keys(keyEvidence)) {
    if (removeLc.has(k.toLowerCase())) delete keyEvidence[k];
  }
  return { ...scored, pillarScores, keyEvidence };
}
