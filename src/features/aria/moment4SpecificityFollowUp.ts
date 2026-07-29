import { moment4QualifiesAsValidNonApplicable, moment4UserDeclinesToNameSpecificPerson } from './moment4ConcretenessClassification';
import { looksLikeIncompleteCutOffUserAnswer } from './interviewAnswerRelevance';
import {
  countInterviewWords,
  moment4HasGenericSelfDescriptionOpener,
  moment4HasNamedOrReferencedPerson,
  moment4HasSpecificEventDescription,
} from './moment4AnswerSignals';
import { looksLikeMoment4GrudgePrompt, looksLikeMoment4ThresholdQuestion } from './moment4ProbeLogic';
import { normalizeInterviewTypography } from './probeAndScoringUtils';

export {
  countInterviewWords,
  moment4HasGenericSelfDescriptionOpener,
  moment4HasNamedOrReferencedPerson,
  moment4HasSpecificEventDescription,
} from './moment4AnswerSignals';

/** Client-injected once when the first grudge answer lacks concrete person/relationship/situation anchors (see product spec). */
export const MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT =
  "Can you think of a specific person — even if it's just someone from a while back — and tell me a bit more about what happened?";

/** Aligns with elaboration probe unprompted threshold (25 words) — M4 specificity redirect. */
export const MOMENT4_SPECIFICITY_LOW_WORD_THRESHOLD = 25;

export type Moment4SpecificityProbeEval = {
  hasNamedPerson: boolean;
  hasSpecificEvent: boolean;
  genericOpenerDetected: boolean;
  wordCount: number;
  probeShouldFire: boolean;
  triggerReason: string | null;
};

/**
 * Evaluate whether the Moment 4 specificity redirect should fire.
 * Fires when ANY bypass signal is present unless both a named person and specific event are present.
 */
export function evaluateMoment4SpecificityProbe(text: string): Moment4SpecificityProbeEval {
  const wordCount = countInterviewWords(text);
  const hasNamedPerson = moment4HasNamedOrReferencedPerson(text);
  const hasSpecificEvent = moment4HasSpecificEventDescription(text);
  const genericOpenerDetected = moment4HasGenericSelfDescriptionOpener(text);

  if (moment4QualifiesAsValidNonApplicable(text)) {
    return {
      hasNamedPerson,
      hasSpecificEvent,
      genericOpenerDetected,
      wordCount,
      probeShouldFire: false,
      triggerReason: null,
    };
  }

  if (moment4UserDeclinesToNameSpecificPerson(text)) {
    return {
      hasNamedPerson,
      hasSpecificEvent,
      genericOpenerDetected,
      wordCount,
      probeShouldFire: false,
      triggerReason: 'declined_specific_person',
    };
  }

  if (looksLikeIncompleteCutOffUserAnswer(text)) {
    return {
      hasNamedPerson,
      hasSpecificEvent,
      genericOpenerDetected,
      wordCount,
      probeShouldFire: false,
      triggerReason: 'cutoff',
    };
  }

  let probeShouldFire = false;
  let triggerReason: string | null = null;

  if (hasNamedPerson && hasSpecificEvent) {
    probeShouldFire = false;
  } else if (!hasNamedPerson) {
    probeShouldFire = true;
    triggerReason = 'no_named_person';
  } else if (genericOpenerDetected && !hasSpecificEvent) {
    probeShouldFire = true;
    triggerReason = 'generic_opener_no_event';
  } else if (wordCount < MOMENT4_SPECIFICITY_LOW_WORD_THRESHOLD && !hasSpecificEvent) {
    probeShouldFire = true;
    triggerReason = 'low_word_count_no_event';
  }

  return {
    hasNamedPerson,
    hasSpecificEvent,
    genericOpenerDetected,
    wordCount,
    probeShouldFire,
    triggerReason,
  };
}

/**
 * Concrete anchor: specific person/relationship plus identifiable episode — adequate to skip the follow-up probe.
 */
export function hasMoment4PersonRelationshipOrSituationAnchor(text: string): boolean {
  const { hasNamedPerson, hasSpecificEvent } = evaluateMoment4SpecificityProbe(text);
  return hasNamedPerson && hasSpecificEvent;
}

/**
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
 * Fire specificity follow-up when the answer lacks adequate person + event anchors.
 * Adequate anchors skip the probe even when the answer is short.
 */
export function needsMoment4SpecificityFollowUp(text: string): boolean {
  return evaluateMoment4SpecificityProbe(text).probeShouldFire;
}

export function looksLikeMoment4SpecificityFollowUpPrompt(text: string): boolean {
  const n = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const newScript =
    n.includes('can you think of a specific person') &&
    (n.includes('from a while back') || n.includes('a bit more about what happened'));
  /** Legacy longer line (still in saved transcripts). */
  const legacyScript =
    (n.includes('is there any situation that comes to mind') && n.includes('already worked through')) ||
    (n.includes('something from the past that you') && n.includes('already worked through'));
  return newScript || legacyScript;
}

/** Pushback when the interviewer re-asked for specificity after the user already gave a concrete grudge story. */
export function moment4UserDeclinesSpecificityReask(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return false;
  return (
    /\bi\s+just\s+gave\s+you\b/.test(t) ||
    /\bi\s+already\s+gave\s+you\b/.test(t) ||
    /\bi\s+gave\s+you\s+one\b/.test(t) ||
    /\bi\s+just\s+told\s+you\b/.test(t) ||
    /\bi\s+already\s+told\s+you\b/.test(t) ||
    /\bi\s+just\s+said\b/.test(t) ||
    /\bi\s+already\s+(said|answered|shared|described)\b/.test(t) ||
    /\bdidn'?t\s+i\s+already\b/.test(t)
  );
}

export function lastAssistantContentBeforeCurrentUser(
  messages: ReadonlyArray<{ role: string; content?: string | null }>,
): string {
  if (!messages.length) return '';
  const endIdx =
    messages[messages.length - 1]?.role === 'user' ? messages.length - 2 : messages.length - 1;
  for (let i = endIdx; i >= 0; i--) {
    if (messages[i].role === 'assistant') return (messages[i].content ?? '').trim();
  }
  return '';
}

export function isAnsweringMoment4SpecificityFollowUp(
  messages: ReadonlyArray<{ role: string; content?: string | null }>,
  lastAssistantContent?: string,
): boolean {
  const lastAssistant =
    (lastAssistantContent ?? '').trim() || lastAssistantContentBeforeCurrentUser(messages);
  return looksLikeMoment4SpecificityFollowUpEcho(lastAssistant);
}

export function extractLastMoment4GrudgeUserAnswer(
  messages: ReadonlyArray<{ role: string; content?: string | null }>,
): string | null {
  let lastGrudgeIdx = -1;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'assistant' && looksLikeMoment4GrudgePrompt(m.content ?? '')) {
      lastGrudgeIdx = i;
    }
  }
  if (lastGrudgeIdx < 0) return null;
  for (let i = lastGrudgeIdx + 1; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    const text = (m.content ?? '').trim();
    if (text && !moment4UserDeclinesSpecificityReask(text)) return text;
  }
  return null;
}

export function resolveMoment4GrudgeAnswerForThresholdReflection(
  messages: ReadonlyArray<{ role: string; content?: string | null }>,
  currentUserAnswer: string,
): string {
  if (moment4UserDeclinesSpecificityReask(currentUserAnswer)) {
    return extractLastMoment4GrudgeUserAnswer(messages) ?? currentUserAnswer;
  }
  return currentUserAnswer;
}

/** Model elaboration after a grudge answer — user must respond before commitment-threshold probe. */
export function looksLikeMoment4GrudgeElaborationFollowUp(text: string): boolean {
  if (looksLikeMoment4SpecificityFollowUpPrompt(text)) return true;
  if (looksLikeMoment4SpecificityFollowUpEcho(text)) return true;
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || looksLikeMoment4ThresholdQuestion(t)) return false;
  const low = t.toLowerCase();
  if (/\bwhat actually happened\b/.test(low)) return true;
  if (
    /\b(tell me|walk me through|share)( a bit)? more\b/.test(low) &&
    /\b(happened|between you|what went on|between you two)\b/.test(low)
  ) {
    return true;
  }
  if (/\bcan you tell me\b/.test(low) && /\b(more about|what happened|actually happened)\b/.test(low)) {
    return true;
  }
  if (/\blike a\b/.test(low) && /\b(tell me|bit more|what happened)\b/.test(low)) {
    return true;
  }
  if (/\bwhen you think about (?:that |the )?relationship\b/.test(low) && /\bis there a part\b/.test(low)) {
    return true;
  }
  if (/\bwhen you think about that relationship now\b/.test(low)) return true;
  return false;
}

/** Model ack after specificity pushback without the commitment-threshold question. */
export function looksLikeMoment4SpecificityCorrectionAck(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || looksLikeMoment4ThresholdQuestion(t)) return false;
  const low = t.toLowerCase();
  return (
    (/\byou'?re right\b/.test(low) || /\bmy mistake\b/.test(low) || /\byou gave me\b/.test(low)) &&
    !/\?\s*$/.test(t)
  );
}

/**
 * Broader than {@link looksLikeMoment4SpecificityFollowUpPrompt}: model paraphrases the same intent
 * after the client already spoke the scripted line — used to strip duplicate paragraphs / streaming TTS.
 */
export function looksLikeMoment4SpecificityFollowUpEcho(text: string): boolean {
  if (looksLikeMoment4SpecificityFollowUpPrompt(text)) return true;
  const raw = (text ?? '').trim();
  if (!raw) return false;
  if (looksLikeMoment4ThresholdQuestion(raw)) return false;
  if (looksLikeMoment4GrudgePrompt(raw)) return false;
  const n = normalizeInterviewTypography(raw).replace(/\s+/g, ' ').trim().toLowerCase();
  if (/\bis there anything specific\b/.test(n)) return true;
  if (/\banything specific\b/.test(n) && /\b(come to mind|remember|share|tell me|you'd like)\b/.test(n)) {
    return true;
  }
  if (
    /\b(is there |any )(a )?specific (person|situation|example|memory|story)\b/.test(n) &&
    (n.includes('come to mind') || n.includes('comes to mind') || n.includes('think of'))
  ) {
    return true;
  }
  if (/\bwhen you think about situations like that\b/.test(n)) return true;
  if (/\bwhere there(?:'s| is) real hurt\b/.test(n)) return true;
  return false;
}

/** Streaming / API may flush before the specificity ask completes (model paraphrase of the grudge follow-up). */
export function isIncompleteMoment4SpecificityFollowUpLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || looksLikeMoment4SpecificityFollowUpPrompt(t)) return false;
  if (looksLikeMoment4ThresholdQuestion(t)) return false;
  if (looksLikeMoment4GrudgePrompt(t)) return false;
  if (/\?\s*$/.test(t) && looksLikeMoment4SpecificityFollowUpEcho(t)) return false;
  const low = t.toLowerCase();
  if (/\bwhen you think about situations like that\b/.test(low)) return true;
  if (/\bwhere there(?:'s| is) real hurt\b/.test(low)) return true;
  if (/\breal hurt\b/.test(low) && !/\?\s*$/.test(t)) return true;
  if (looksLikeMoment4SpecificityFollowUpEcho(t) && !/\?\s*$/.test(t)) return true;
  return false;
}

function extractBriefAckBeforeIncompleteMoment4SpecificityProbe(text: string): string | null {
  const match = /^(got it|thanks|thank you|okay|ok|i hear you|i understand)\b[,.!?…\s—–-]*/i.exec(
    text.trim(),
  );
  if (!match) return null;
  const ack = match[1].trim();
  return ack.length > 0 ? ack.charAt(0).toUpperCase() + ack.slice(1).toLowerCase() : null;
}

/** Replace truncated / paraphrased M4 specificity follow-up copy with the canonical scripted line. */
export function coerceMoment4SpecificityFollowUpForTts(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT;
  if (looksLikeMoment4ThresholdQuestion(t) || looksLikeMoment4GrudgePrompt(t)) return t;
  if (looksLikeMoment4SpecificityFollowUpPrompt(t) && /\?\s*$/.test(t)) {
    if (t.toLowerCase() !== MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT.toLowerCase()) {
      return MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT;
    }
    return t;
  }
  if (
    isIncompleteMoment4SpecificityFollowUpLeadSentence(t) ||
    (looksLikeMoment4SpecificityFollowUpEcho(t) && !/\?\s*$/.test(t))
  ) {
    const ack = extractBriefAckBeforeIncompleteMoment4SpecificityProbe(t);
    if (ack) return `${ack}. ${MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT}`;
    return MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT;
  }
  return t;
}

/**
 * Parallel streaming TTS flushes by sentence before post-processing strips the full assistant turn.
 * When the client already spoke {@link MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT}, suppress model echoes.
 *
 * @returns `null` when the flushed sentence should be skipped for TTS; otherwise text to speak.
 */
export function stripMoment4SpecificityFollowUpStreamingEcho(
  spoken: string,
  clientSpecificityInjected: boolean,
): string | null {
  const t0 = (spoken ?? '').trim();
  if (!clientSpecificityInjected || !t0) {
    return t0;
  }
  if (!looksLikeMoment4SpecificityFollowUpEcho(t0)) {
    return t0;
  }
  if (looksLikeMoment4ThresholdQuestion(t0)) {
    const firstQm = t0.indexOf('?');
    if (firstQm >= 0) {
      const rest = t0.slice(firstQm + 1).trim().replace(/^[.\s—–-]+/, '');
      if (rest.length > 0 && looksLikeMoment4ThresholdQuestion(rest)) {
        return rest;
      }
    }
    return t0;
  }
  return null;
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

  if (
    moment4QualifiesAsValidNonApplicable(firstUserAfterGrudge.content) ||
    moment4UserDeclinesToNameSpecificPerson(firstUserAfterGrudge.content)
  ) {
    return true;
  }

  if (looksLikeIncompleteCutOffUserAnswer(firstUserAfterGrudge.content)) {
    return false;
  }

  if (!needsMoment4SpecificityFollowUp(firstUserAfterGrudge.content)) {
    return true;
  }

  const specIdx = afterGrudge.findIndex(
    (m) =>
      m.role === 'assistant' &&
      looksLikeMoment4SpecificityFollowUpEcho((m as { content?: string }).content ?? ''),
  );
  if (specIdx >= 0) {
    const afterSpec = afterGrudge.slice(specIdx + 1);
    if (afterSpec.some((m) => m.role === 'user')) return true;
  }

  return false;
}
