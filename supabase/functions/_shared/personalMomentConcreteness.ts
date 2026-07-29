import { reconcileMoment4Concreteness } from '../../../src/features/aria/moment4ConcretenessClassification.ts';
import {
  CONCRETENESS_DEPTH_DELTA_BOTH_ABSENT,
  CONCRETENESS_DEPTH_DELTA_BOTH_HIGH,
  CONCRETENESS_DEPTH_DELTA_BOTH_LOW,
  CONCRETENESS_DEPTH_DELTA_BOTH_MODERATE,
  CONCRETENESS_DEPTH_DELTA_HIGH_MODERATE,
  CONCRETENESS_DEPTH_DELTA_LOW_MODERATE,
  CONCRETENESS_DEPTH_DELTA_MIXED_ABSENT_LOW,
  CONCRETENESS_GATE_MODIFIER_BOTH_ABSENT,
  CONCRETENESS_GATE_MODIFIER_BOTH_LOW,
  CONCRETENESS_GATE_MODIFIER_MIXED_ABSENT_LOW,
} from '../../../src/config/scoring/personalMomentConcretenessModifiers.ts';

export type ResponseConcretenessLevel = 'absent' | 'low' | 'moderate' | 'high';

export type Moment4ConcretenessLevel = ResponseConcretenessLevel | 'valid_non_applicable';

export function normalizeMoment4Concreteness(raw: unknown): Moment4ConcretenessLevel | null {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  if (
    t === 'absent' ||
    t === 'low' ||
    t === 'moderate' ||
    t === 'high' ||
    t === 'valid_non_applicable'
  ) {
    return t as Moment4ConcretenessLevel;
  }
  return null;
}

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

/** M4 slice / column — includes `valid_non_applicable`. */
export function moment4ResponseConcretenessFromStoredMomentBundle(
  raw: unknown,
): Moment4ConcretenessLevel | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return (
    normalizeMoment4Concreteness(o.response_concreteness) ??
    normalizeMoment4Concreteness(o.specificity)
  );
}

/**
 * Resolve Moment 4 concreteness for gate/modifier paths.
 * Reconciles model "low"/"absent" to `valid_non_applicable` when grudge transcript qualifies.
 */
export function mergeMoment4ConcretenessForGate(
  storedMoment: unknown,
  rowColumnFallback: unknown,
  moment4UserText?: string | null,
): Moment4ConcretenessLevel | null {
  const fromStored = moment4ResponseConcretenessFromStoredMomentBundle(storedMoment);
  const fromColumn = normalizeMoment4Concreteness(rowColumnFallback);
  const raw = fromStored ?? fromColumn;
  const text = (moment4UserText ?? '').trim();
  if (text) {
    return reconcileMoment4Concreteness(raw, text);
  }
  return raw;
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

export function computePersonalMomentConcretenessModifier(
  moment4: string | null | undefined,
  moment5: string | null | undefined,
): number {
  const a = normalizeMoment4Concreteness(moment4);
  const b = normalizeResponseConcreteness(moment5);
  // valid_non_applicable: coherent reflective answer explaining genuine absence of grudges — neutral.
  if (a === 'valid_non_applicable') return 0;
  if (a == null || b == null) return 0;
  if (a === 'moderate' || a === 'high' || b === 'moderate' || b === 'high') return 0;
  if (a === 'absent' && b === 'absent') return CONCRETENESS_GATE_MODIFIER_BOTH_ABSENT;
  if (a === 'low' && b === 'low') return CONCRETENESS_GATE_MODIFIER_BOTH_LOW;
  if ((a === 'absent' && b === 'low') || (a === 'low' && b === 'absent')) {
    return CONCRETENESS_GATE_MODIFIER_MIXED_ABSENT_LOW;
  }
  return 0;
}

export function moment4Moment5ConcretenessDepthSignalDelta(
  moment4: string | null | undefined,
  moment5: string | null | undefined,
): number {
  const m4 = normalizeMoment4Concreteness(moment4) ?? '';
  const m5 = (moment5 ?? '').toString().trim().toLowerCase();
  if (m4 === 'valid_non_applicable') return 0;
  if (m4 === 'absent' && m5 === 'absent') return CONCRETENESS_DEPTH_DELTA_BOTH_ABSENT;
  if ((m4 === 'absent' && m5 === 'low') || (m4 === 'low' && m5 === 'absent')) {
    return CONCRETENESS_DEPTH_DELTA_MIXED_ABSENT_LOW;
  }
  if (m4 === 'low' && m5 === 'low') return CONCRETENESS_DEPTH_DELTA_BOTH_LOW;
  if ((m4 === 'low' && m5 === 'moderate') || (m4 === 'moderate' && m5 === 'low')) {
    return CONCRETENESS_DEPTH_DELTA_LOW_MODERATE;
  }
  if (m4 === 'moderate' && m5 === 'moderate') return CONCRETENESS_DEPTH_DELTA_BOTH_MODERATE;
  if ((m4 === 'high' && m5 === 'moderate') || (m4 === 'moderate' && m5 === 'high')) {
    return CONCRETENESS_DEPTH_DELTA_HIGH_MODERATE;
  }
  if (m4 === 'high' && m5 === 'high') return CONCRETENESS_DEPTH_DELTA_BOTH_HIGH;
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

export const RESPONSE_CONCRETENESS_SCORING_INSTRUCTION = `Assess the concreteness of the user's personal response on a 4-level scale and return as response_concreteness:
absent — no personal example provided. User deflected with general philosophy, claimed no relevant experiences, or refused to engage with the personal nature of the question.
low — vague reference to a type of situation or general pattern without naming a specific person, event, or time period. Could have been said by anyone.
moderate — specific person or situation named but thin on narrative detail. The story exists but lacks emotional content, behavioral specifics, or personal reflection.
high — specific person named, concrete event described, emotional content present, and some degree of personal reflection on the user's own experience or contribution.
Return response_concreteness as a string field in the scoring output alongside pillarScores and keyEvidence. Use exactly one of these lowercase values: "absent", "low", "moderate", "high".`;
