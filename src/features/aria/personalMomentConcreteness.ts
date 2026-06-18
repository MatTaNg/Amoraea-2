/** Model output for personal moments 4 & 5 (strict lowercase in JSON contract). */
export type ResponseConcretenessLevel = 'absent' | 'low' | 'moderate' | 'high';

export type { Moment4ConcretenessLevel } from './moment4ConcretenessClassification';
export {
  MOMENT4_RESPONSE_CONCRETENESS_SCORING_INSTRUCTION,
  moment4Moment5ConcretenessDepthSignalDelta,
  moment4QualifiesAsValidNonApplicable,
  normalizeMoment4Concreteness,
  reconcileMoment4Concreteness,
} from './moment4ConcretenessClassification';
import { normalizeMoment4Concreteness } from './moment4ConcretenessClassification';

export function normalizeResponseConcreteness(raw: unknown): ResponseConcretenessLevel | null {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  if (t === 'absent' || t === 'low' || t === 'moderate' || t === 'high') return t as ResponseConcretenessLevel;
  return null;
}

/** `response_concreteness` from a stored `moment_*_scores` JSON blob (client / DB). */
export function responseConcretenessFromStoredMomentBundle(raw: unknown): ResponseConcretenessLevel | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return (
    normalizeResponseConcreteness(o.response_concreteness) ??
    normalizeResponseConcreteness(o.specificity)
  );
}

/** Prefer scorer JSON; fall back to denormalized `interview_attempts.moment_*_concreteness` columns. */
export function mergeMomentConcretenessForGate(
  storedMoment: unknown,
  rowColumnFallback: unknown,
): ResponseConcretenessLevel | null {
  const fromStored = responseConcretenessFromStoredMomentBundle(storedMoment);
  if (fromStored != null) return fromStored;
  return normalizeResponseConcreteness(rowColumnFallback);
}

/** Weighted gate adjustment from paired personal-moment concreteness (non-positive). */
export function computePersonalMomentConcretenessModifier(
  moment4: string | null | undefined,
  moment5: string | null | undefined,
): number {
  const a = normalizeMoment4Concreteness(moment4);
  const b = normalizeResponseConcreteness(moment5);
  // valid_non_applicable: user gave a coherent, reflective answer explaining genuine
  // absence of grudges. This is informative signal about the construct (whether they
  // hold onto grudges) and should not be penalized as a disclosure failure. Distinct
  // from `absent`, which is reserved for genuine bypass/non-engagement.
  if (a === 'valid_non_applicable') return 0;
  if (a == null || b == null) return 0;
  if (a === 'moderate' || a === 'high' || b === 'moderate' || b === 'high') return 0;
  if (a === 'absent' && b === 'absent') return -0.3;
  if (a === 'low' && b === 'low') return -0.2;
  if ((a === 'absent' && b === 'low') || (a === 'low' && b === 'absent')) return -0.25;
  return 0;
}

export function bothPersonalMomentsAbsentOrLow(
  moment4: string | null | undefined,
  moment5: string | null | undefined,
): boolean {
  const a = normalizeMoment4Concreteness(moment4);
  const b = normalizeResponseConcreteness(moment5);
  if (a == null || b == null) return false;
  const weakM4 = a === 'absent' || a === 'low';
  const weakM5 = b === 'absent' || b === 'low';
  return weakM4 && weakM5;
}

/** Inserted into Moment 5 scoring prompts — keep JSON field `response_concreteness` in sync. */
export const RESPONSE_CONCRETENESS_SCORING_INSTRUCTION = `Assess the concreteness of the user's personal response on a 4-level scale and return as response_concreteness:
absent — no personal example provided. User deflected with general philosophy, claimed no relevant experiences, or refused to engage with the personal nature of the question.
low — vague reference to a type of situation or general pattern without naming a specific person, event, or time period. Could have been said by anyone.
moderate — specific person or situation named but thin on narrative detail. The story exists but lacks emotional content, behavioral specifics, or personal reflection.
high — specific person named, concrete event described, emotional content present, and some degree of personal reflection on the user's own experience or contribution.
Return response_concreteness as a string field in the scoring output alongside pillarScores and keyEvidence. Use exactly one of these lowercase values: "absent", "low", "moderate", "high".`;
