import { normalizeInterviewTypography } from './probeAndScoringUtils';
import { looksLikeMoment4GrudgePrompt } from './moment4ProbeLogic';

/** Client-injected once when the first grudge answer lacks concrete person/relationship/situation anchors (see product spec). */
export const MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT =
  "Is there any situation that comes to mind, even something from the past you've already worked through?";

export function countInterviewWords(text: string): number {
  const t = (text ?? '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

const RELATIONSHIP_OR_ROLE_RE =
  /\b(mom|mother|dad|father|parent|sister|brother|family|aunt|uncle|cousin|grandparent|wife|husband|partner|ex[- ]?partner|boyfriend|girlfriend|spouse|fianc[eé]|friend|coworker|co-worker|colleague|boss|manager|neighbor|teacher|roommate)\b/i;

/** Named person-like token (not sentence-initial I/A); conservative. */
const LIKELY_NAME_RE = /\b(?!I\b|A\b|The\b|We\b|It\b|So\b|If\b|My\b|In\b|At\b|On\b|He\b|She\b|They\b)[A-Z][a-z]{2,}\b/;

/** Situational anchors — exclude bare temporal adverbs ("before" as in "I've done it before"). */
const INCIDENT_OR_SITUATION_RE =
  /\b(when|once|that time|that day|that night|years?\s*ago|last\s+(year|week|month)|at\s+(work|school|home)|in\s+(high\s+)?school|happened|we\s+(went|fought|argued|talked|met)|told\s+me|said\s+to\s+me|called\s+me|found\s+out|broke\s+up|split\s+up)\b/i;

const AFTER_BEFORE_LINKED_RE =
  /\b(after|before)\s+(that|this|the|we|it|she|he|they|i|you)\b/i;

const SOCIAL_ANCHOR_RE =
  /\b(my|a|an)\s+(friend|coworker|co-worker|colleague|neighbor|roommate|boss|ex|partner)\b/i;

const SOMEONE_I_KNEW_RE = /\bsomeone\s+I\s+(knew|dated|worked\s+with|went\s+to\s+school\s+with)\b/i;

const THIS_THAT_PERSON_RE = /\b(this|that)\s+person\b/i;

/** "This woman", "the driver", etc. — concrete referent without a proper name. */
const THIS_THAT_THE_HUMAN_REF_RE =
  /\b(this|that|the)\s+(woman|man|guy|girl|lady|gentleman|person|people|driver|dude|kid)\b/i;

/**
 * Grudge answers often use "someone" / "people in my life" without a proper name — still a concrete social frame
 * (session_logs: M4_SPECIFICITY_FOLLOWUP_INJECT on long forgive/boundaries answers that included these phrases).
 */
const GRUDGE_OR_SOCIAL_CUTOFF_REF_RE =
  /\b(hold(?:ing)?\s+a\s+)?grudge\s+against\s+someone\b|\bdon'?t\s+include\s+those\s+people\b|\b(those|these)\s+people\s+in\s+my\s+life\b|\bpeople\s+in\s+my\s+life\b/i;

/**
 * Concrete anchor: specific person/relationship, named individual, or identifiable situation — not generic habits or emotion-only.
 * Used to decide if the Moment 4 grudge answer already carries enough specificity to skip the follow-up probe.
 */
export function hasMoment4PersonRelationshipOrSituationAnchor(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '').trim();
  if (!t) return false;
  if (RELATIONSHIP_OR_ROLE_RE.test(t)) return true;
  if (LIKELY_NAME_RE.test(t)) return true;
  if (INCIDENT_OR_SITUATION_RE.test(t) || AFTER_BEFORE_LINKED_RE.test(t)) return true;
  if (SOCIAL_ANCHOR_RE.test(t)) return true;
  if (SOMEONE_I_KNEW_RE.test(t)) return true;
  if (THIS_THAT_PERSON_RE.test(t)) return true;
  if (THIS_THAT_THE_HUMAN_REF_RE.test(t)) return true;
  if (GRUDGE_OR_SOCIAL_CUTOFF_REF_RE.test(t)) return true;
  return false;
}

/**
 * True when the answer carries at least one of: named relationship/role, described incident, or emotional detail.
 * @deprecated Prefer {@link hasMoment4PersonRelationshipOrSituationAnchor} for grudge specificity gating; kept for callers that still want the broader signal.
 */
export function hasMoment4SpecificPersonalSignal(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '').trim();
  if (!t) return false;
  if (hasMoment4PersonRelationshipOrSituationAnchor(text)) return true;
  if (
    /\b(feel|felt|feeling|angry|mad|upset|hurt|hurting|scared|afraid|anxious|frustrat|annoyed|hated|hate|resent|bitter|ashamed|guilty|sad|embarrassed|disgusted)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Fire specificity follow-up when the answer lacks a person/relationship/situation anchor
 * (vague generalities). Adequate anchors skip the probe even when the answer is short.
 */
export function needsMoment4SpecificityFollowUp(text: string): boolean {
  if (hasMoment4PersonRelationshipOrSituationAnchor(text)) return false;
  return true;
}

export function looksLikeMoment4SpecificityFollowUpPrompt(text: string): boolean {
  const n = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const newScript =
    n.includes('is there any situation that comes to mind') && n.includes('already worked through');
  /** Legacy longer line (still in saved transcripts). */
  const legacyScript =
    n.includes('something from the past that you') && n.includes('already worked through');
  return newScript || legacyScript;
}

function looksLikeMoment4WalkAwayThresholdAssistantPrompt(text: string): boolean {
  const t = (text ?? '').toLowerCase();
  return (
    t.includes(
      '"at what point do you decide when a relationship is something to work through versus something you need to walk away from?"',
    ) ||
    (t.includes('work through') && t.includes('walk away') && t.includes('point'))
  );
}

/**
 * Resume / hydrate: after restoring messages, true iff the grudge→specificity gate has already been satisfied
 * (first answer specific, or user answered after specificity probe, or threshold already appears).
 */
export function deriveMoment4PostGrudgeSpecificityResolvedFromMessages(
  messages: ReadonlyArray<{ role: string; content?: string }>
): boolean {
  if (messages.length === 0) return false;
  if (messages.some((m) => m.role === 'assistant' && looksLikeMoment4WalkAwayThresholdAssistantPrompt(m.content ?? ''))) {
    return true;
  }

  let lastGrudgeIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant' && looksLikeMoment4GrudgePrompt(m.content ?? '')) {
      lastGrudgeIdx = i;
      break;
    }
  }
  if (lastGrudgeIdx < 0) return false;

  const afterGrudge = messages.slice(lastGrudgeIdx + 1);
  const firstUserAfterGrudge = afterGrudge.find((m) => m.role === 'user');
  if (!firstUserAfterGrudge?.content?.trim()) return false;

  if (!needsMoment4SpecificityFollowUp(firstUserAfterGrudge.content)) {
    return true;
  }

  const specIdx = afterGrudge.findIndex(
    (m) => m.role === 'assistant' && looksLikeMoment4SpecificityFollowUpPrompt(m.content ?? '')
  );
  if (specIdx >= 0) {
    const afterSpec = afterGrudge.slice(specIdx + 1);
    if (afterSpec.some((m) => m.role === 'user')) return true;
  }

  return false;
}
