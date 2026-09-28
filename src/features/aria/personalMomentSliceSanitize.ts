import { isNoEvidenceText } from '@features/aria/probeEvidenceUtils';
import { looksLikeAssessableSpontaneousRepairEvidence } from '@features/aria/spontaneousRepairEvidence';
export type PersonalMomentSliceForSanitize = {
  momentNumber?: 4;
  pillarScores: Record<string, number | null>;
  pillarConfidence?: Record<string, string>;
  keyEvidence?: Record<string, string>;
  summary?: string;
  specificity?: string;
  momentName?: string;
  mentalizing_overcertainty?: boolean;
  response_concreteness?: string | null;
  emotional_vocab_count?: number | null;
  emotional_vocab_words?: string[];
  user_slice_word_count?: number | null;
  scoringMetadata?: Record<string, unknown> | null;
};

const M4_REMOVE: readonly string[] = [
  'attunement',
  'appreciation',
];

const M5_REMOVE: readonly string[] = [
  'commitment_threshold',
  'appreciation',
  'attunement',
  'contempt_recognition',
  'contempt',
];

function keepSpontaneousRepairIfAssessable(
  pillarScores: Record<string, number | null>,
  keyEvidence: Record<string, string>,
): void {
  const scoreKey = Object.keys(pillarScores).find((k) => k.toLowerCase() === 'repair');
  const evidenceKey = Object.keys(keyEvidence).find((k) => k.toLowerCase() === 'repair');
  const score = scoreKey != null ? pillarScores[scoreKey] : undefined;
  const evidence = evidenceKey != null ? keyEvidence[evidenceKey] : undefined;
  const numeric = typeof score === 'number' && Number.isFinite(score);
  if (!numeric || isNoEvidenceText(evidence) || !looksLikeAssessableSpontaneousRepairEvidence(evidence)) {
    if (scoreKey) delete pillarScores[scoreKey];
    if (evidenceKey) delete keyEvidence[evidenceKey];
  }
}

/**
 * Personal-moment prompts score only listed constructs; strip anything else the model echoes
 * so aggregates and stored JSON cannot leak e.g. Moment 4 `attunement` into pillar math or admin views.
 * Spontaneous repair is kept only when evidence is assessable (not a leaked midpoint).
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
  keepSpontaneousRepairIfAssessable(pillarScores, keyEvidence);
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
  mentalizing_overcertainty?: boolean;
  response_concreteness?: string | null;
  emotional_vocab_count?: number | null;
  emotional_vocab_words?: string[];
  user_slice_word_count?: number | null;
  scoringMetadata?: Record<string, unknown> | null;
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

const SUPPORT_KEEP = new Set([
  'responsiveness_support',
  'need_recognition',
  'attunement',
  'support_response',
  'adaptability',
  'mentalizing',
  'regulation',
  'repair',
]);

export type PersonalMomentSupportSliceForSanitize = {
  momentNumber?: 6;
  pillarScores: Record<string, number | null>;
  pillarConfidence?: Record<string, string>;
  keyEvidence?: Record<string, string>;
  summary?: string;
  specificity?: string;
  momentName?: string;
  mentalizing_overcertainty?: boolean;
  response_concreteness?: string | null;
  emotional_vocab_count?: number | null;
  emotional_vocab_words?: string[];
  user_slice_word_count?: number | null;
  scoringMetadata?: Record<string, unknown> | null;
};

/** Keep only support-moment pillars/slices; drop leaked constructs from the model. */
export function sanitizeSupportMomentScoresForAggregate(
  scored: PersonalMomentSupportSliceForSanitize | null,
): PersonalMomentSupportSliceForSanitize | null {
  if (!scored?.pillarScores) return scored;
  const pillarScores: Record<string, number | null> = {};
  const keyEvidence: Record<string, string> = {};
  for (const [k, v] of Object.entries(scored.pillarScores)) {
    if (SUPPORT_KEEP.has(k.toLowerCase())) pillarScores[k] = v;
  }
  for (const [k, v] of Object.entries(scored.keyEvidence ?? {})) {
    if (SUPPORT_KEEP.has(k.toLowerCase())) keyEvidence[k] = v;
  }
  keepSpontaneousRepairIfAssessable(pillarScores, keyEvidence);
  return { ...scored, pillarScores, keyEvidence };
}
