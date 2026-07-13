import { normalizeInterviewTypography } from './interviewTypography';
import {
  MOMENT_5_ACCOUNTABILITY_PROBE_TEXT,
  MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT,
} from '@features/aria/moment5ProbeCopy';
import { moment5PersonalNarrativeHasConcreteAnchor } from '@features/aria/moment5ConcreteAnchor';
import { looksLikeMoment5ConflictValidityClarificationPrompt } from '@features/aria/moment5ConflictValidity';
import { MOMENT5_LIKELY_PROPER_NAME_RE } from '@features/aria/moment5SpecificityRedirect';
import {
  moment5TranscriptHasConcreteAnchor,
  moment5UserDeclinesConcreteReask,
} from '@features/aria/moment5TranscriptHelpers';

const STRONG_ACCOUNTABILITY_MARKERS = [
  'my part',
  'my mistake',
  'my fault',
  'i contributed',
  'i take responsibility',
  'i own',
  "that's on me",
  'i tend to',
  'i have a pattern',
  'i realize i',
  'i realise i',
  'i acknowledge',
] as const;

/** Strong accountability via "I need to …" — excludes emotional-vent phrasing (Deb-style dump/hear). */
function moment5StrongNeedToAccountability(lower: string): boolean {
  if (/\bi\s+need\s+to\s+(dump|vent|express\s+my\s+feelings|share\s+my\s+feelings|be\s+heard|hear\s+them)\b/i.test(lower)) {
    return false;
  }
  return /\bi\s+need\s+to\s+(own|work\s+on|take|apologize|apologise|change|improve|do\s+better|communicate|listen)\b/i.test(
    lower
  );
}

function moment5HasStrongAccountabilityMarker(text: string): boolean {
  if (moment5AnswerHasExplicitSelfAccountability(text)) return true;
  const lower = (text ?? '').trim().toLowerCase();
  if (moment5StrongNeedToAccountability(lower)) return true;
  if (STRONG_ACCOUNTABILITY_MARKERS.some((marker) => lower.includes(marker))) return true;
  return (
    /\bi\s+should\s+have\b/.test(lower) ||
    /\bi\s+could\s+have\b/.test(lower) ||
    /\bi\s+wasn'?t\b/.test(lower) ||
    /\bi\s+didn'?t\s+(listen|communicate|say|handle|own|take)\b/.test(lower)
  );
}

/** Emotional engagement inside a conflict episode — not bare venting ("I was pissed") without ownership. */
function moment5ModerateSelfRefSkipsProbe(text: string): boolean {
  if (!moment5ConflictEpisodeContext(text)) return false;
  if (moment5AnswerHasExplicitSelfAccountability(text)) return true;
  const lower = (text ?? '').trim().toLowerCase();
  return (
    /\bi\s+felt\s+(hurt|triggered|defensive|dismissed)\b/i.test(lower) ||
    /\bi\s+feel\s+like\s+i\s+was\b/i.test(lower) ||
    /\bi\s+was\s+too\s+harsh\s+in\s+the\s+argument\b/i.test(lower)
  );
}

const MODERATE_SELF_REFERENCE_MARKERS = ['i feel', 'i think', 'i need', 'for me', "i've", "i'm"] as const;

const CONFLICT_CONTEXT_MARKERS = [
  'conflict',
  'argument',
  'fight',
  'disagreement',
  'tension',
  'upset',
  'hurt',
  'wrong',
  'apologize',
  'apologise',
  'sorry',
  'mistake',
] as const;

export type Moment5AccountabilityProbeSignalAnalysis = {
  hasStrongAccountability: boolean;
  hasModerateSelfRef: boolean;
  /** Keyword-level conflict mention (e.g. "I've had conflicts before"). */
  hasConflictKeyword: boolean;
  /** First-person engagement inside a described conflict episode — not abstract conflict talk alone. */
  hasConflictEpisodeContext: boolean;
  hasNarrative: boolean;
};

/** Conflict language tied to a described episode, not merely abstract mention of "conflicts". */
export function moment5ConflictEpisodeContext(text: string): boolean {
  const lower = (text ?? '').trim().toLowerCase();
  const hasConflictKeyword = CONFLICT_CONTEXT_MARKERS.some((marker) => lower.includes(marker));
  if (!hasConflictKeyword) return false;
  return (
    /\bi\s+had\s+a(?:\s+\w+){0,3}\s+conflict\b/i.test(lower) ||
    /\bhad\s+a\s+(?:massive|big|major|serious|huge)\s+conflict\b/i.test(lower) ||
    /\bwe\s+(argued|fought|had\s+a\s+(?:\w+\s+){0,2}(?:fight|argument|disagreement))\b/i.test(lower) ||
    /\b(i|we)\s+felt\s+(hurt|upset|angry|triggered|defensive|dismissed)\b/i.test(lower) ||
    /\b(i|we)\s+(yelled|apologized|apologised|walked\s+away|shut\s+down|overreacted|escalated)\b/i.test(lower) ||
    /\bi\s+told\s+(him|her|them)\b/i.test(lower) ||
    /\bi\s+was\s+too\s+harsh\s+in\s+the\s+argument\b/i.test(lower)
  );
}

export function analyzeMoment5AccountabilityProbeSignals(responseText: string): Moment5AccountabilityProbeSignalAnalysis {
  const text = (responseText ?? '').trim().toLowerCase();
  const hasStrongAccountability = moment5HasStrongAccountabilityMarker(responseText);
  const hasModerateSelfRef = MODERATE_SELF_REFERENCE_MARKERS.some((marker) => text.includes(marker));
  const hasConflictKeyword = CONFLICT_CONTEXT_MARKERS.some((marker) => text.includes(marker));
  const hasConflictEpisodeContext = moment5ConflictEpisodeContext(responseText);
  const hasNarrative = moment5PersonalNarrativeHasConcreteAnchor(responseText);
  return {
    hasStrongAccountability,
    hasModerateSelfRef,
    hasConflictKeyword,
    hasConflictEpisodeContext,
    hasNarrative,
  };
}

/**
 * Fire when the answer lacks explicit self-accountability — not gated on having a conflict narrative first.
 */
export function shouldFireAccountabilityProbe(responseText: string): boolean {
  if (!responseText || responseText.trim().length === 0) return true;

  if (moment5AnswerHasExplicitSelfAccountability(responseText)) {
    console.log('[AccountabilityProbe] explicit self-accountability — not probing');
    return false;
  }

  const selfRef = evaluateMoment5AccountabilitySelfReference(responseText);
  if (
    selfRef.self_reference_type === 'boundary_expression' ||
    selfRef.self_reference_type === 'specific_ownership'
  ) {
    console.log('[AccountabilityProbe] self-reference type — not probing', selfRef.self_reference_type);
    return false;
  }

  const { hasStrongAccountability, hasModerateSelfRef, hasConflictEpisodeContext } =
    analyzeMoment5AccountabilityProbeSignals(responseText);

  if (hasStrongAccountability) {
    console.log('[AccountabilityProbe] strong accountability detected — not probing');
    return false;
  }

  if (hasModerateSelfRef && hasConflictEpisodeContext && moment5ModerateSelfRefSkipsProbe(responseText)) {
    console.log('[AccountabilityProbe] moderate self-ref with conflict episode engagement — not probing');
    return false;
  }

  console.log('[AccountabilityProbe] no accountability signal found — probing', {
    hasModerateSelfRef,
    hasConflictEpisodeContext,
  });
  return true;
}

export function pickMoment5AccountabilityProbeSpokenText(
  _responseText: string,
  opts?: { griefAckPrefix?: boolean },
): string {
  return opts?.griefAckPrefix
    ? MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT
    : MOMENT_5_ACCOUNTABILITY_PROBE_TEXT;
}

export function looksLikeMoment5AccountabilityProbeAssistantPrompt(text: string | null | undefined): boolean {
  const raw = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return false;
  const t = raw.toLowerCase();
  const directAccountabilityAsk =
    t.includes('what do you think you did or said that contributed to the conflict') ||
    t.includes('what do you think you did or said that contributed to it') ||
    t.includes('contributed to the conflict') ||
    t.includes('what was your part in how it unfolded') ||
    (t.includes('your part') && t.includes('unfolded')) ||
    (t.includes('appreciate you getting vulnerable') &&
      (t.includes('contributed to the conflict') || t.includes('your part'))) ||
    /\bwhat was your part in how\b/.test(t) ||
    /\bwhat part did you play\b/.test(t) ||
    /\byour part in how it (all )?(started|began|unfolded|played out|happened|went)\b/.test(t) ||
    (t.includes('specific time you had a conflict') &&
      (t.includes('contributed') || t.includes('your part')));
  if (!directAccountabilityAsk) return false;
  /** Soft "hear more about your part" tail on conflict-validity clarifications — not the scripted probe. */
  if (
    looksLikeMoment5ConflictValidityClarificationPrompt(raw) &&
    !/\bwhat was your part\b/.test(t) &&
    !/\bwhat part did you play\b/.test(t) &&
    !/\byour part in how\b/.test(t)
  ) {
    return false;
  }
  return true;
}

/**
 * When the client already delivered the accountability probe, remove a duplicate ask that the model glued
 * into the same paragraph (post-processing only sees one `\\n\\n` block).
 */
export function stripEmbeddedMoment5AccountabilityProbeAsk(draft: string): string {
  const t0 = (draft ?? '').trim();
  if (!t0) return draft;
  let t = normalizeInterviewTypography(t0);
  const patterns: RegExp[] = [
    /\bI appreciate you getting vulnerable with me\.?\s*/gi,
    /\bThat makes sense as a general approach\.?\s*/gi,
    /\bwhat do you think you did or said that contributed to (the conflict|it)\b[\s\S]{0,120}?\?/gi,
    /\bwhat was your part in how\b[\s\S]{0,120}?\?/gi,
    /\bwhat part did you play\b[\s\S]{0,120}?\?/gi,
    /\b(?:can|could)\s+you\s+think\s+of\s+a\s+specific\s+time\b[\s\S]{0,420}?\b(contributed|your part)\b[\s\S]{0,120}?\?/gi,
  ];
  let prev = '';
  while (prev !== t) {
    prev = t;
    for (const re of patterns) {
      t = t.replace(re, '').replace(/\s{2,}/g, ' ').trim();
    }
  }
  return t
    .replace(/^\s*[.,;—–\-–]\s*/g, '')
    .replace(/\s+[.,;—–\-–]\s*$/g, '')
    .trim();
}

/**
 * Parallel streaming TTS flushes by sentence before duplicate stripping on the full assistant turn.
 * When the accountability probe was already spoken, suppress model echoes in a flushed chunk.
 *
 * @returns `null` when the whole flushed sentence should be skipped for TTS; otherwise the text to speak.
 */
export function stripMoment5AccountabilityProbeStreamingEcho(
  spoken: string,
  accountabilityProbeAlreadyAsked: boolean,
): string | null {
  const t0 = normalizeInterviewTypography((spoken ?? '').trim());
  if (!accountabilityProbeAlreadyAsked || !t0) {
    return t0;
  }
  if (looksLikeMoment5AccountabilityProbeAssistantPrompt(t0)) {
    return null;
  }
  if (
    /\bwhat do you think you did or said that contributed\b/i.test(t0) ||
    /\bwhat was your part in how\b/i.test(t0) ||
    /\bwhat part did you play\b/i.test(t0)
  ) {
    return null;
  }
  return t0;
}


export type Moment5AccountabilityProbeEvaluation = {
  shouldProbe: boolean;
  /** Machine-readable: why we fire the scripted probe, or why we skip it. */
  reason:
    | 'lacks_explicit_self_accountability'
    | 'explicit_self_accountability'
    | 'too_short'
    | 'decline_or_vague_evade';
  selfReference: Moment5AccountabilitySelfReferenceEvaluation;
};

export type Moment5AccountabilitySelfReferenceType =
  | 'general_advice'
  | 'specific_ownership'
  | 'boundary_expression'
  | 'process_description';

export type Moment5AccountabilitySelfReferenceEvaluation = {
  accountability_probe_self_reference_detected: boolean;
  self_reference_type: Moment5AccountabilitySelfReferenceType;
};

/**
 * Voluntary ownership of one's part in the conflict — **not** mere first-person narration
 * ("I felt…", "I said…", "I remember…") which can still be blame-only.
 */
export function moment5AnswerHasExplicitSelfAccountability(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  return (
    /\bi\s+contributed\b/i.test(t) ||
    /\bmy\s+role\s+(was|here|in\s+that)\b/i.test(lower) ||
    /\bmy\s+part\s+(was|here|in\s+that)\b/i.test(lower) ||
    /\bhow\s+i\s+(contributed|acted|handled|messed up|made things worse|made it worse)\b/i.test(lower) ||
    /\bwhat\s+i\s+did\s+wrong\b/i.test(lower) ||
    /\bI\s+realiz(?:e|ed)\s+i\b/i.test(t) ||
    /\bI\s+realis(?:e|ed)\s+i\b/i.test(t) ||
    /\bi\s+also\s+(knew|realized|realised|should|could|regret|thought\s+i\s+was|had\s+to\s+admit|felt\s+responsible|took\s+(some\s+)?(blame|responsibility)|owned)\b/i.test(lower) ||
    /\bmy\s+(fault|mistake)\b/i.test(lower) ||
    /\b(that|this)\s+was\s+on\s+me\b/i.test(lower) ||
    /\bI\s+take\s+responsibility\b/i.test(t) ||
    /\bi\s+took\s+responsibility\b/i.test(lower) ||
    /\bi\s+take\s+ownership\b/i.test(lower) ||
    /\bi\s+took\s+ownership\b/i.test(lower) ||
    /\bi\s+own(?:ed)?\s+(my|that|it)\b/i.test(lower) ||
    /\bi\s+own(?:ed)?\s+my\s+side\b/i.test(lower) ||
    /\bmy\s+side\s+of\s+(this|it|that)\b/i.test(lower) ||
    /\bmy\s+responsibilit(?:y|ies)\s+was\b/i.test(lower) ||
    /\bI\s+was\s+(wrong|at fault|to blame|unfair|defensive|too harsh)\b/i.test(t) ||
    /\bi\s+was\s+(out\s+of\s+line|disrespectful|controlling|accusatory)\b/i.test(lower) ||
    /\bi\s+crossed\s+a\s+line\b/i.test(lower) ||
    /\bi\s+did\s+(yell|raise\s+my\s+voice|snap|shut\s+down|stonewall|withdraw|avoid)\b/i.test(lower) ||
    /\bi\s+raised\s+my\s+voice\b/i.test(lower) ||
    /\bi\s+(yelled|shouted|snapped)\b/i.test(lower) ||
    /\bi\s+shut\s+(him|her|them)\s+out\b/i.test(lower) ||
    /\bi\s+(wasn'?t|was\s+not|didn'?t)\s+listen(?:ing)?\b/i.test(lower) ||
    /\bi\s+(got|became)\s+(defensive|reactive)\b/i.test(lower) ||
    /\bi\s+got\s+accusatory\b/i.test(lower) ||
    /\bi\s+came\s+in\s+hot\b/i.test(lower) ||
    /\bi\s+came\s+at\s+(him|her|them)\s+hard\b/i.test(lower) ||
    /\bI\s+(should|could)\s+have\b/i.test(t) ||
    /\bi\s+should(?:n'?t| not)\s+have\s+reacted\s+like\s+that\b/i.test(lower) ||
    /\bi\s+could\s+have\s+communicat(?:ed|e)\s+better\b/i.test(lower) ||
    /\bI\s+wish\s+I(\s+had)?\b/i.test(t) ||
    /\bI\s+(apologized|apologised)\b/i.test(t) ||
    /\bI\s+('?m|am)\s+sorry\s+(for\s+)?(what\s+i|my|how\s+i)\b/i.test(t) ||
    /\bI\s+(owned|admitted)\b/i.test(t) ||
    /\bI\s+acknowledged\s+(that|my|the|I)\b/i.test(t) ||
    /\bI\s+(overreacted|escalated)\b/i.test(t) ||
    /\bi\s+handled\s+(it|that)\s+(badly|poorly)\b/i.test(lower) ||
    /\bi\s+was\s+projecting\b/i.test(lower) ||
    /\bi\s+(made|was\s+making)\s+assumptions\b/i.test(lower) ||
    /\bi\s+jumped\s+to\s+conclusions\b/i.test(lower) ||
    /\bmy\s+share\s+of\b/i.test(lower) ||
    /\b(part|role)\s+i\s+(played|had|took)\b/i.test(lower) ||
    /\bI\s+regret\s+(what\s+i|my|how\s+i|that\s+i)\b/i.test(t) ||
    /\bI\s+see\s+(now\s+)?that\s+i\b/i.test(t) ||
    (/\blooking\s+back,?\s+i\b/i.test(lower) &&
      /\b(wrong|should|could|regret|fault|mistake|overreact|unfair|defensive)\b/i.test(lower))
  );
}

export function evaluateMoment5AccountabilitySelfReference(
  userText: string
): Moment5AccountabilitySelfReferenceEvaluation {
  const t = userText.replace(/\s+/g, ' ').trim();
  const lower = t.toLowerCase();
  if (!t) {
    return { accountability_probe_self_reference_detected: false, self_reference_type: 'process_description' };
  }

  const boundaryExpression =
    /\bi\s+(would\s+have\s+appreciated|would'?ve\s+appreciated)\b/i.test(lower) ||
    /\bi\s+(set\s+a\s+limit|set\s+a\s+boundary)\b/i.test(lower) ||
    /\bi\s+don'?t\s+take\s+(your|his|her|their|someone'?s)?\s*(opinion|criticism|feedback)\s+seriously\b/i.test(
      lower
    ) ||
    /\bi\s+told\s+(him|her|them)\b.{0,120}\b(appreciated|limit|boundary|don'?t\s+take)\b/i.test(lower);
  if (boundaryExpression) {
    return { accountability_probe_self_reference_detected: true, self_reference_type: 'boundary_expression' };
  }

  const specificConflictSelfReference =
    moment5AnswerHasExplicitSelfAccountability(t) ||
    /\bi\s+(yelled|shouted|snapped|raised\s+my\s+voice|got\s+triggered|was\s+triggered|shut\s+down|withdrew|walked\s+away|stormed\s+off|avoided|stonewalled|got\s+defensive|became\s+defensive|overreacted|escalated|calmed\s+down|regulated\s+myself|apologized|apologised)\b/i.test(
      lower
    ) ||
    /\bi\s+(didn'?t|did\s+not)\s+(communicate|listen|say|explain|understand|handle)\b/i.test(lower) ||
    /\bi\s+was\s+the\s+one\s+who\b/i.test(lower) ||
    /\bi\s+got\s+triggered\s+because\b/i.test(lower) ||
    /\bi\s+was\s+(just\s+)?(starting\s+out|insecure)\b/i.test(lower);
  if (specificConflictSelfReference) {
    return { accountability_probe_self_reference_detected: true, self_reference_type: 'specific_ownership' };
  }

  const generalAdvice =
    /\bi\s+(think|believe|find|feel)\s+(it'?s|it\s+is)?\s*(important|helpful|better|good|useful)\b/i.test(lower) ||
    /\b(communication|listening|taking\s+turns|repeat(?:ing)?\s+back)\s+is\s+(just\s+)?(really\s+)?(important|helpful|useful)\b/i.test(
      lower
    ) ||
    /\bi\s+(always|usually|generally|try\s+to|like\s+to|make\s+sure)\b.{0,80}\b(conflict|heard|understood|listen|repeat|communicat|take\s+turns)\b/i.test(
      lower
    );
  return {
    accountability_probe_self_reference_detected: false,
    self_reference_type: generalAdvice ? 'general_advice' : 'process_description',
  };
}

/**
 * Moment 5: true when the user's answer is **abstract** for pipeline purposes — no anchored episode,
 * no concrete first-person behavior in a described conflict, only generic principles or process habits.
 * Used after the specificity redirect to decide accountability-probe vs move-on.
 */
export function moment5ResponseIsAbstract(userText: string): boolean {
  const raw = userText.replace(/\s+/g, ' ').trim();
  if (!raw || raw.length < 20) return true;
  if (moment5PersonalNarrativeHasConcreteAnchor(raw)) return false;
  if (moment5AnswerHasExplicitSelfAccountability(raw)) return false;

  const sr = evaluateMoment5AccountabilitySelfReference(raw);
  if (sr.self_reference_type === 'specific_ownership' || sr.self_reference_type === 'boundary_expression') {
    return false;
  }

  const lower = raw.toLowerCase();
  /** Named other + narrative cue — not abstract even if {@link moment5PersonalNarrativeHasConcreteAnchor} missed an edge case. */
  if (
    MOMENT5_LIKELY_PROPER_NAME_RE.test(raw) &&
    /\b(called|said|told|would|did|got|felt|when|after|during|because|argu|fight|tense|upset|judged|coach|conflict|resolved|facilitator)\b/i.test(
      raw,
    )
  ) {
    return false;
  }
  if (
    /\b(with|from)\s+[A-Z][a-z]{1,24}\b/i.test(raw) &&
    /\b(said|told|would|did|got|felt|when|after|during|because|argu|fight|tense)\b/i.test(raw)
  ) {
    return false;
  }
  if (
    /\b(last\s+(year|month|week|night)|during\s+the\s+breakup|after\s+the\s+argument|one\s+time|at\s+one\s+point|a\s+few\s+years\s+ago)\b/i.test(
      lower,
    )
  ) {
    return false;
  }
  /** Concrete first-person act in conflict context (broader than explicit accountability). */
  if (
    /\bi\s+(shut\s+down|walked\s+away|yelled|snapped|avoided|stonewall|said\s+something|didn'?t\s+listen|stopped\s+listening|overreacted|escalated)\b/i.test(
      lower,
    )
  ) {
    return false;
  }

  return true;
}

/**
 * Client-injected specificity redirect — independent of accountability `shouldProbe`.
 * Thin answers (`too_short`) previously skipped the redirect block and hit the model, which could
 * yield elongating-only turns stripped to empty transcript rows.
 */
/** True when the current reply or prior M5 user turns already anchor a concrete episode. */
export function moment5UserOrTranscriptHasConcreteAnchor(
  userText: string,
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
): boolean {
  if (moment5PersonalNarrativeHasConcreteAnchor(userText)) return true;
  return moment5TranscriptHasConcreteAnchor(transcript);
}

export function shouldInjectMoment5SpecificityRedirect(params: {
  userText: string;
  narrativeConcrete: boolean;
  answeringAfterSpecificityRedirect: boolean;
  specificityRedirectIssued: boolean;
  specificityRedirectInTranscript: boolean;
}): boolean {
  if (moment5PersonalNarrativeHasConcreteAnchor(params.userText)) return false;
  if (params.narrativeConcrete) return false;
  if (params.answeringAfterSpecificityRedirect) return false;
  if (params.specificityRedirectIssued || params.specificityRedirectInTranscript) return false;
  const evalResult = evaluateMoment5AccountabilityProbe(params.userText);
  if (evalResult.reason === 'too_short') return true;
  /** Any non-thin answer without a concrete anchor needs specificity before resolution/accountability/API. */
  return true;
}

/**
 * At most one scripted follow-up: fire unless the user already names their **own** contribution
 * to the tension (not only story-telling or other-blame).
 */
export function evaluateMoment5AccountabilityProbe(userText: string): Moment5AccountabilityProbeEvaluation {
  const t = userText.replace(/\s+/g, ' ').trim();
  const lower = t.toLowerCase();
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  const selfReference = evaluateMoment5AccountabilitySelfReference(t);
  const signals = analyzeMoment5AccountabilityProbeSignals(t);

  console.log('[AccountabilityProbe] response text:', t.slice(0, 200));
  console.log('[AccountabilityProbe] hasNarrative:', signals.hasNarrative);
  console.log('[AccountabilityProbe] hasSelfReference:', selfReference.accountability_probe_self_reference_detected);
  console.log('[AccountabilityProbe] hasStrongAccountability:', signals.hasStrongAccountability);
  console.log('[AccountabilityProbe] hasModerateSelfRef:', signals.hasModerateSelfRef);
  console.log('[AccountabilityProbe] hasConflictKeyword:', signals.hasConflictKeyword);
  console.log('[AccountabilityProbe] hasConflictEpisodeContext:', signals.hasConflictEpisodeContext);

  if (moment5UserDeclinesConcreteReask(t)) {
    return { shouldProbe: false, reason: 'decline_or_vague_evade', selfReference };
  }
  if (t.length < 36 || wordCount < 10) {
    return { shouldProbe: false, reason: 'too_short', selfReference };
  }
  if (/\b(i don'?t have|nothing comes|can'?t think|no conflict|never really|not sure what to say)\b/i.test(lower) && t.length < 100) {
    return { shouldProbe: false, reason: 'decline_or_vague_evade', selfReference };
  }

  const probeConditionMet = shouldFireAccountabilityProbe(t);
  console.log('[AccountabilityProbe] probeConditionMet:', probeConditionMet);

  if (probeConditionMet) {
    return { shouldProbe: true, reason: 'lacks_explicit_self_accountability', selfReference };
  }
  return { shouldProbe: false, reason: 'explicit_self_accountability', selfReference };
}

/** @deprecated Prefer {@link evaluateMoment5AccountabilityProbe} for logging; boolean is equivalent to `shouldProbe`. */
export function shouldProbeMoment5NoSelfReference(userText: string): boolean {
  return evaluateMoment5AccountabilityProbe(userText).shouldProbe;
}

