import {
  moment4HasNamedOrReferencedPerson,
  moment4HasSpecificEventDescription,
  countInterviewWords,
} from './moment4AnswerSignals';
import {
  normalizeMoment4Concreteness,
  type Moment4ConcretenessLevel,
} from './moment4ConcretenessClassification';
import { normalizeInterviewTypography } from './interviewTypography';

export const M4_UNASSESSABLE_INNER_STATE_EVIDENCE =
  'Not assessed — Moment 4 disclosure too thin to assess inner-state content for this marker (low concreteness or insufficient narrative depth).';

const M4_INNER_STATE_MARKERS = ['mentalizing', 'accountability', 'contempt_recognition'] as const;
export type Moment4InnerStateMarker = (typeof M4_INNER_STATE_MARKERS)[number];

const INNER_STATE_CUES =
  /\b(feel|felt|feeling|afraid|fear|scared|hurt|dread(?:ing)?|anxious|upset|lonely|ashamed|vulnerable|embarrassed|look(?:ed)?\s+forward|excited|overwhelm|internal|subjectively)\b/i;

const RELATIONAL_DEPTH_CUES =
  /\b(why|what (?:they|he|she)|perspective|their (?:side|feelings|experience)|my part|i (?:realized|learned|understood|could have|should have)|might (?:be|have)|felt like|read as|empath|attun)\b/i;

/**
 * True when M4 user text supports scoring mentalizing / accountability / contempt_recognition:
 * a named person or specific episodic anchor **and** enough emotional / inner-state narrative
 * (not logistics-only or thin event summary).
 */
export function moment4HasAssessableInnerStateContent(userText: string): boolean {
  const t = normalizeInterviewTypography(userText ?? '').trim();
  if (!t) return false;
  if (!moment4HasNamedOrReferencedPerson(t) && !moment4HasSpecificEventDescription(t)) {
    return false;
  }
  if (!INNER_STATE_CUES.test(t)) return false;
  if (RELATIONAL_DEPTH_CUES.test(t)) return true;
  return countInterviewWords(t) >= 45;
}

export function moment4ConcretenessImpliesUnassessableInnerStateMarkers(
  concreteness: Moment4ConcretenessLevel | null | undefined,
): boolean {
  return concreteness === 'low' || concreteness === 'absent';
}

export function moment4InnerStateMarkersShouldBeNull(params: {
  response_concreteness?: string | null;
  userText: string;
  lowSpecificityAfterProbe?: boolean;
}): boolean {
  const concreteness = normalizeMoment4Concreteness(params.response_concreteness);
  if (concreteness === 'valid_non_applicable') return false;
  if (params.lowSpecificityAfterProbe === true) return true;
  return !moment4HasAssessableInnerStateContent(params.userText);
}

function nullifyMoment4InnerStateMarker(
  pillarScores: Record<string, number | null | undefined>,
  keyEvidence: Record<string, string>,
  pillarConfidence: Record<string, string> | undefined,
  marker: Moment4InnerStateMarker,
): void {
  pillarScores[marker] = null;
  keyEvidence[marker] = M4_UNASSESSABLE_INNER_STATE_EVIDENCE;
  if (pillarConfidence) {
    pillarConfidence[marker] = 'not_assessed';
  }
}

/**
 * Programmatic guard: thin M4 disclosures must yield JSON null on inner-state markers —
 * not floor scores like 4–5. `valid_non_applicable` and substantive assessable inner-state
 * text are left to the model.
 */
export function applyMoment4UnassessableNullRules(params: {
  pillarScores: Record<string, number | null | undefined>;
  keyEvidence: Record<string, string>;
  pillarConfidence?: Record<string, string>;
  response_concreteness?: string | null;
  userText: string;
  lowSpecificityAfterProbe?: boolean;
}): boolean {
  if (!moment4InnerStateMarkersShouldBeNull(params)) return false;

  let changed = false;
  for (const marker of M4_INNER_STATE_MARKERS) {
    const raw = params.pillarScores[marker];
    if (raw === null && params.keyEvidence[marker] === M4_UNASSESSABLE_INNER_STATE_EVIDENCE) {
      continue;
    }
    if (raw !== null || params.keyEvidence[marker] !== M4_UNASSESSABLE_INNER_STATE_EVIDENCE) {
      nullifyMoment4InnerStateMarker(
        params.pillarScores,
        params.keyEvidence,
        params.pillarConfidence,
        marker,
      );
      changed = true;
    }
  }
  return changed;
}
