/** Model output for personal Moment 4 / Moment 5 concreteness rubric. */
export type ResponseConcretenessLevel = 'absent' | 'low' | 'moderate' | 'high';

export const RESPONSE_CONCRETENESS_SCORING_INSTRUCTION = `Assess the concreteness of the user's personal response on a 4-level scale and return as response_concreteness:
absent — no personal example provided. User deflected with general philosophy, claimed no relevant experiences, or refused to engage with the personal nature of the question.
low — vague reference to a type of situation or general pattern without naming a specific person, event, or time period. Could have been said by anyone.
moderate — specific person or situation named but thin on narrative detail. The story exists but lacks emotional content, behavioral specifics, or personal reflection.
high — specific person named, concrete event described, emotional content present, and some degree of personal reflection on the user's own experience or contribution.
Return response_concreteness as a string field in the scoring output alongside pillarScores and keyEvidence.`;

export function normalizeResponseConcreteness(raw: unknown): ResponseConcretenessLevel | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === 'absent' || s === 'low' || s === 'moderate' || s === 'high') return s as ResponseConcretenessLevel;
  return null;
}

/**
 * Weighted-threshold adjustment from paired personal-moment concreteness (Moment 4 + 5).
 * Returns 0 when either level is unknown, or when any moment is moderate/high.
 */
export function personalMomentConcretenessModifierFromLevels(
  m4: ResponseConcretenessLevel | null,
  m5: ResponseConcretenessLevel | null,
): number {
  if (m4 === 'moderate' || m4 === 'high' || m5 === 'moderate' || m5 === 'high') return 0;
  if (m4 == null || m5 == null) return 0;
  if (m4 === 'absent' && m5 === 'absent') return -0.3;
  if (m4 === 'low' && m5 === 'low') return -0.2;
  if ((m4 === 'absent' && m5 === 'low') || (m4 === 'low' && m5 === 'absent')) return -0.25;
  return 0;
}

export function bothPersonalMomentsAbsentOrLow(
  m4: ResponseConcretenessLevel | null,
  m5: ResponseConcretenessLevel | null,
): boolean {
  if (m4 == null || m5 == null) return false;
  return (m4 === 'absent' || m4 === 'low') && (m5 === 'absent' || m5 === 'low');
}
