import type { BuildPersonalMomentHandoffReflectionOptions } from './personalMomentHandoffReflection';
import { extractLeadingReflectionFromMoment4ThresholdProbe } from './deliveredReflectionRegistry';
import { hasCommitmentThresholdSignal } from './interviewMoment5AppreciationBridge';
import {
  looksLikeIncompleteCutOffUserAnswer,
  looksLikeUnassessableScenarioAnswer,
} from './interviewAnswerRelevance';
import { looksLikeGoBackToPreviousScenarioRequest } from './interviewGoBackRequest';
import { normalizeInterviewTypography } from './interviewTypography';

export type Moment4RelationshipType = 'close' | 'non_close' | 'mixed' | 'unknown';

export function evaluateMoment4RelationshipType(text: string): {
  relationshipType: Moment4RelationshipType;
  closeSignals: string[];
  nonCloseSignals: string[];
} {
  const t = (text ?? '').toLowerCase();
  const closeChecks: Array<{ id: string; re: RegExp }> = [
    { id: 'romantic_partner', re: /\b(ex[- ]?partner|partner|wife|husband|boyfriend|girlfriend|fiance|spouse)\b/ },
    { id: 'close_friend', re: /\b(close friend|best friend)\b/ },
    { id: 'family', re: /\b(mom|mother|dad|father|sister|brother|family|aunt|uncle|cousin|son|daughter)\b/ },
  ];
  const nonCloseChecks: Array<{ id: string; re: RegExp }> = [
    { id: 'coworker', re: /\b(coworker|co-worker|colleague|workmate|work friend|work partner)\b/ },
    { id: 'boss_or_manager', re: /\b(boss|manager|supervisor)\b/ },
    { id: 'acquaintance', re: /\b(acquaintance|neighbor|client|customer)\b/ },
  ];
  const closeSignals = closeChecks.filter((c) => c.re.test(t)).map((c) => c.id);
  const nonCloseSignals = nonCloseChecks.filter((c) => c.re.test(t)).map((c) => c.id);
  const relationshipType: Moment4RelationshipType =
    closeSignals.length > 0 && nonCloseSignals.length === 0
      ? 'close'
      : closeSignals.length === 0 && nonCloseSignals.length > 0
        ? 'non_close'
        : closeSignals.length > 0 && nonCloseSignals.length > 0
          ? 'mixed'
          : 'unknown';
  return { relationshipType, closeSignals, nonCloseSignals };
}

/**
 * Commitment-threshold follow-up in Moment 4 (repair vs leave framing).
 * Shared with AriaScreen for injection detection, resume restore, and Moment 5 handoff.
 */
export const MOMENT_4_GRUDGE_QUESTION_TEXT =
  "Think of someone you've had a really hard time with — maybe a falling out, a grudge, or just someone who got under your skin. Tell me what happened there, and where things stand now." as const;

/** Client-injected Moment 4 commitment-threshold follow-up (verbatim ack + question). */
export const MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT =
  'Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?' as const;

/** Language that actually addresses the work-through vs walk-away fork (not bare "partner" mention). */
const MOMENT4_THRESHOLD_FORK_LANGUAGE_RE =
  /\b(work(?:ing)?\s+(?:through|on|it)|walk(?:ing)?\s+away|leave|leaving|end (?:it|the relationship|things)|stay(?:ing)?\s+(?:and|to)|try(?:ing)?\s+(?:to\s+)?(?:fix|repair|save|work)|break(?:ing)?\s+up|divorce|separat(?:e|ion)|give up|give\s+(?:it|the relationship)\s+(?:up|a chance)|red line|deal[- ]?breaker|not worth|too (?:toxic|broken|far)|when (?:trust|respect|love)|at what point|draw the line|dread(?:ing)?|can't(?:not)?\s+(?:fix|save|continue)|no longer|stop trying)\b/i;

/** Work-through / stay side of the threshold fork (e.g. "worth saving if you love each other"). */
const MOMENT4_THRESHOLD_WORK_THROUGH_COMMITMENT_RE =
  /\b(?:worth\s+(?:sav(?:ing|e)|it|trying|fighting\s+for)|save(?:ing)?\s+(?:it|the\s+relationship|when|if)|willing\s+to\s+(?:do\s+)?(?:the\s+)?work|work\s+together|(?:do|put\s+in)\s+the\s+work|no\s+matter\s+how\s+hard|fight\s+for\s+(?:it|the\s+relationship|each\s+other)|keep\s+(?:working|trying|going))\b/i;

/**
 * True when a user answer to the M4 commitment-threshold question cannot be scored —
 * including mic-stop conditionals and short replies that never address stay vs leave.
 */
export function looksLikeUnassessableMoment4ThresholdAnswer(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return true;
  if (looksLikeUnassessableScenarioAnswer(t)) return true;
  if (hasCommitmentThresholdSignal(t)) return false;
  const low = t.toLowerCase().replace(/[\u201c\u201d\u2018\u2019]/g, "'");
  if (MOMENT4_THRESHOLD_FORK_LANGUAGE_RE.test(low)) return false;
  if (MOMENT4_THRESHOLD_WORK_THROUGH_COMMITMENT_RE.test(low)) return false;
  const wordCount = low.split(/\s+/).filter(Boolean).length;
  // Partner/relationship keywords alone do not satisfy the threshold fork — block M5 advance.
  return wordCount <= 30;
}

/**
 * Moment 4 grudge answer → commitment-threshold follow-up.
 * No leading reflection — interviewer instructions require the threshold question alone after the grudge answer.
 */
export function buildMoment4ThresholdProbeWithReflection(
  _lastGrudgeAnswer: string,
  _reflectionOpts?: BuildPersonalMomentHandoffReflectionOptions,
): string {
  return MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;
}

/** Show-scenario card body (question only, no leading ack). */
export const MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY =
  'At what point do you decide when a relationship is something to work through versus something you need to walk away from?' as const;

export function looksLikeMoment4ThresholdQuestion(text: string): boolean {
  const normalized = (text ?? '')
    .replace(/\u2019/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
  const t = normalized.toLowerCase();
  const canonicalPhrase =
    t.includes(
      '"at what point do you decide when a relationship is something to work through versus something you need to walk away from?"',
    ) ||
    t.includes(
      'at what point do you decide when a relationship is something to work through versus something you need to walk away from',
    );
  const walkAwayPhrase = /\bwalk(?:ing)? away\b/.test(t);
  const workThroughPhrase = /\bwork(?:ing)? through\b/.test(t);
  const lineBetweenWorkAndLeaveFork =
    workThroughPhrase &&
    walkAwayPhrase &&
    (/\bwhere(?:'s| is) your line\b/.test(t) ||
      /\byour line between\b/.test(t) ||
      /\bcuts deep\b/.test(t));
  const workVsLeaveFork =
    workThroughPhrase &&
    walkAwayPhrase &&
    (/\b(at what point|what point|when (?:do you|would you|have you|did you) decide)\b/.test(t) ||
      /\b(decide (?:if|whether)|worth working through|stay and work|leave or stay)\b/.test(t) ||
      /\bwhere(?:'s| is) your line\b/.test(t) ||
      t.includes('point'));
  const friendshipContinuingFork =
    (/\b(friendship|relationship)\b/.test(t) &&
      /\b(worth continuing|continue the (friendship|relationship)|always know you'?d|considered whether)\b/.test(
        t,
      ) &&
      /\b(work through|worth continuing|walk away|walking away|end (?:it|the friendship))\b/.test(t)) ||
    (/\bconsidered whether\b/.test(t) &&
      /\b(worth continuing|work through it|work through)\b/.test(t));
  const thresholdVersusWalkAwayFork =
    /\bthreshold\b/.test(t) && workThroughPhrase && walkAwayPhrase && /\bversus\b/.test(t);
  const trustBrokenFriendshipFork =
    /\b(trust gets broken|trust was broken|broken trust)\b/.test(t) &&
    /\bfriendship\b/.test(t) &&
    workThroughPhrase &&
    walkAwayPhrase;
  const workThroughVersusWalkAwayPersonalityFork =
    workThroughPhrase &&
    walkAwayPhrase &&
    (/\btends to work through\b/.test(t) ||
      /\bwork(?:ing)? through it\b/.test(t) ||
      /\bwhen something like that (?:comes up|happens)\b/.test(t) ||
      /\bif something like that (?:comes up|happened|happens)\b/.test(t) ||
      /\bsomeone you care about\b/.test(t) ||
      /\bkind of thing you(?:'|’)d work through\b/.test(t) ||
      /\bmore the kind of thing\b/.test(t) ||
      /\breal tension with another person\b/.test(t) ||
      /\bcuts deep\b/.test(t) ||
      (/\bare you someone who\b/.test(t) && /\b(?:walk away|walking away)\b/.test(t)));
  return (
    canonicalPhrase ||
    lineBetweenWorkAndLeaveFork ||
    workVsLeaveFork ||
    friendshipContinuingFork ||
    thresholdVersusWalkAwayFork ||
    trustBrokenFriendshipFork ||
    workThroughVersusWalkAwayPersonalityFork
  );
}

function normalizeMoment4ThresholdCompare(text: string): string {
  return normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/[.!?…]+$/, '');
}

/** True when assistant copy is already the scripted threshold line (full inject or card body only). */
export function isCanonicalMoment4ThresholdQuestionText(text: string): boolean {
  const norm = normalizeMoment4ThresholdCompare(text);
  const canonicalFull = normalizeMoment4ThresholdCompare(MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT);
  const canonicalBody = normalizeMoment4ThresholdCompare(MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY);
  if (norm === canonicalFull || norm === canonicalBody) return true;
  return norm.endsWith(canonicalBody) && norm.includes('thanks for sharing');
}

function extractBriefAckBeforeMoment4ThresholdProbe(text: string): string | null {
  const match =
    /^(got it|thanks|thank you|okay|ok|i hear you|i understand|makes sense)\b[,.!?…\s—–-]*/i.exec(
      text.trim(),
    );
  if (!match) return null;
  const ack = match[1].trim();
  return ack.length > 0 ? ack.charAt(0).toUpperCase() + ack.slice(1).toLowerCase() : null;
}

/** Streaming may flush before the walk-away fork arrives (model paraphrase of the threshold question). */
export function isIncompleteMoment4ThresholdLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || looksLikeMoment4ThresholdQuestion(t)) return false;
  const low = t.toLowerCase();
  if (/\bwhen you think about what it takes\b/.test(low)) return true;
  if (/\bwhat it takes to fully work through\b/.test(low)) return true;
  if (/\bwhen something like that (?:comes up|happens)\b/.test(low)) return true;
  if (/\bcuts deep\b/.test(low)) return true;
  if (/\bwhere(?:'s| is) your line\b/.test(low) && !/\bwalk away\b/.test(low)) return true;
  if (/\bwork through something\b/.test(low) && !/\bwalk away\b/.test(low)) return true;
  if (
    /\b(?:at what point|what point).*\bwork(?:ing)? through\b/.test(low) &&
    !/\bwalk away\b/.test(low) &&
    !/\?\s*$/.test(t)
  ) {
    return true;
  }
  if (
    /\b(?:decide|know).*\bwork(?:ing)? through\b/.test(low) &&
    !/\bwalk away\b/.test(low) &&
    !/\?\s*$/.test(t)
  ) {
    return true;
  }
  if (
    /\bwhen it comes to\b/.test(low) &&
    /\brelationships?\b/.test(low) &&
    (/\bwhat'?s your\b/.test(low) || /\bwhat is your\b/.test(low) || /\bthreshold\b/.test(low)) &&
    !/\?\s*$/.test(t)
  ) {
    return true;
  }
  if (/\bwhen it came to that situation\b/.test(low)) return true;
  if (/\bwhen it came to\b/.test(low) &&
    /\b(?:that situation|relationships?)\b/.test(low) &&
    !/\?\s*$/.test(t)
  ) {
    return true;
  }
  if (/\bwhen things go sideways\b/.test(low)) return true;
  if (/\bwhether it'?s that\s*$/i.test(t)) return true;
  if (/[—–-]\s*whether\b/i.test(t) && !/\?\s*$/.test(t)) return true;
  if (/\bis there a point\b/.test(low) && !/\bwalk away\b/.test(low)) return true;
  if (
    /\brelationships?\b/.test(low) &&
    /\bwhat'?s your\s*$/i.test(t) &&
    !/\?\s*$/.test(t)
  ) {
    return true;
  }
  return (
    /\b(?:relationship|friendship)\b/.test(low) &&
    /\bwork(?:ing)? through\b/.test(low) &&
    !/\bwalk away\b/.test(low) &&
    !/\?\s*$/.test(t)
  );
}

/** Partial threshold paraphrase without the full walk-away fork — not yet a complete question. */
export function looksLikeMoment4ThresholdParaphraseInProgress(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || looksLikeMoment4ThresholdQuestion(t)) return false;
  if (isIncompleteMoment4ThresholdLeadSentence(t)) return true;
  const low = t.toLowerCase();
  return (
    /\bwork(?:ing)? through\b/.test(low) &&
    /\b(?:walk away|walking away|versus|vs\.?)\b/.test(low) &&
    !/\?\s*$/.test(t)
  );
}

/** Expand truncated / paraphrased M4 commitment-threshold copy to the canonical scripted question. */
export function coerceMoment4ThresholdQuestionForTts(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;
  if (extractLeadingReflectionFromMoment4ThresholdProbe(t)) {
    return MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;
  }
  if (isCanonicalMoment4ThresholdQuestionText(t)) return t;
  if (
    looksLikeMoment4ThresholdQuestion(t) ||
    looksLikeMoment4ThresholdParaphraseInProgress(t) ||
    isIncompleteMoment4ThresholdLeadSentence(t)
  ) {
    const ack = extractBriefAckBeforeMoment4ThresholdProbe(t);
    if (ack) {
      return `${ack}. Thanks for sharing that. ${MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY}`;
    }
    return MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;
  }
  return t;
}

/** True if any assistant line in the transcript is (or contains) the Moment 4 commitment-threshold follow-up. */
export function transcriptIncludesMoment4ThresholdAssistant(
  msgs: ReadonlyArray<{ role: string; content?: string | null }>
): boolean {
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role !== 'assistant') continue;
    if (looksLikeMoment4ThresholdQuestion(m.content ?? '')) return true;
  }
  return false;
}

/**
 * True when `msgs` contains a Moment-4 threshold assistant line and **no user message appears after
 * the last such line**. Used with `msgs = transcript before the current user turn` so the current
 * turn is the first user response to the walk-away follow-up (M5 handoff), even if the model inserted
 * extra assistant lines after the threshold that are not matched by {@link looksLikeMoment4ThresholdQuestion}.
 */
export function isAnsweringFirstUserTurnAfterMoment4Threshold(
  msgsPriorToCurrentUser: ReadonlyArray<{ role: string; content?: string | null }>
): boolean {
  let lastThresholdIdx = -1;
  for (let i = 0; i < msgsPriorToCurrentUser.length; i++) {
    const m = msgsPriorToCurrentUser[i];
    if (m.role === 'assistant' && looksLikeMoment4ThresholdQuestion(m.content ?? '')) {
      lastThresholdIdx = i;
    }
  }
  if (lastThresholdIdx < 0) return false;
  for (let j = lastThresholdIdx + 1; j < msgsPriorToCurrentUser.length; j++) {
    const m = msgsPriorToCurrentUser[j];
    if (m.role !== 'user') continue;
    const text = (m.content ?? '').trim();
    if (!text) continue;
    /** Unassessable threshold retries do not consume the handoff — M5 injects on the first assessable answer. */
    if (!looksLikeUnassessableMoment4ThresholdAnswer(text)) {
      return false;
    }
  }
  return true;
}

/** Moment 5 conflict paraphrase — must not match {@link looksLikeMoment4GrudgePrompt}. */
function looksLikeMoment5ConflictParaphraseForGrudgeGuard(text: string): boolean {
  const lower = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  return (
    (/\bthink of a time (?:when )?you had a conflict\b/.test(lower) ||
      lower.includes('think of a time when you had a conflict with someone important') ||
      lower.includes('think of a time when you had a conflict with someone close')) &&
    /\b(?:someone (?:important|close)|important to you|close to you)\b/.test(lower)
  );
}

/** True when the last assistant turn is the grudge/dislike question (or full Moment 4 handoff), not threshold or appreciation. */
export function looksLikeMoment4GrudgePrompt(text: string): boolean {
  if (looksLikeMoment4ThresholdQuestion(text)) return false;
  if (looksLikeMoment5ConflictParaphraseForGrudgeGuard(text)) return false;
  const t = (text ?? '').toLowerCase();
  if (t.includes('think of a time you really celebrated someone') || (t.includes('really celebrated') && t.includes('your life'))) {
    return false;
  }
  return (
    t.includes('held a grudge') ||
    /\bhold(?:s|ing)? a grudge\b/.test(t) ||
    (t.includes("really didn't like") && (t.includes('someone') || t.includes('your life'))) ||
    (/\bstruggle to like\b/.test(t) && /\b(anyone|someone)\b/.test(t)) ||
    (t.includes('grudge') && (t.includes('someone') || t.includes('anyone'))) ||
    (t.includes('really hard time with') &&
      (t.includes('what happened') || t.includes('where things stand'))) ||
    (/\bhad a hard time with\b/.test(t) && /\b(anyone|someone)\b/.test(t)) ||
    (/\bis there anyone in your life\b/.test(t) && /\bhard time\b/.test(t)) ||
    (t.includes('got under your skin') &&
      (t.includes('what happened') || t.includes('where things stand'))) ||
    (t.includes('falling out') && t.includes('what happened') && !/\bconflict\b/.test(t))
  );
}

/**
 * User answered as if still in Scenario C (Daniel/Sophie / couples therapy) instead of the personal grudge prompt.
 * Do not inject the commitment follow-up until they address the grudge question — let the model redirect.
 */
export function looksLikeMisplacedNonGrudgeMoment4Answer(text: string): boolean {
  const t = (text ?? '').toLowerCase().trim();
  if (t.length < 35) return false;
  const hasDaniel = /\bdaniel\b/.test(t);
  const hasSophie = /\bsophie\b/.test(t);
  const scenarioCStyleMisread =
    (hasDaniel && hasSophie) ||
    ((hasDaniel || hasSophie) && /\b(couples therapy|recurring argument)\b/.test(t));
  if (!scenarioCStyleMisread) return false;
  const personalGrudgeOrDislikeStory =
    /\b(grudge|really didn't like|didn't like someone|someone in my|close friend|betray|confid|resentment toward|for two years|cut (him|her|them) off)\b/i.test(
      t,
    );
  return !personalGrudgeOrDislikeStory;
}

/**
 * After a substantive answer to the Moment 4 grudge/dislike prompt, the commitment follow-up may fire
 * regardless of relationship wording, tone, or analytical vs emotional content — do not gate on relationshipType.
 * Do not inject when the user is answering a different assistant prompt, or when the answer is clearly misplaced fiction.
 */
export function shouldForceMoment4ThresholdProbe(params: {
  probeAlreadyAsked: boolean;
  isMoment4: boolean;
  lastAssistantContent: string;
  userAnswerText: string;
  /** User is answering the client-injected Moment 4 specificity follow-up (not the grudge prompt). */
  answeringSpecificityFollowUp?: boolean;
}): boolean {
  if (!params.isMoment4 || params.probeAlreadyAsked) return false;
  if (looksLikeGoBackToPreviousScenarioRequest(params.userAnswerText)) return false;
  if (looksLikeIncompleteCutOffUserAnswer(params.userAnswerText)) return false;
  if (params.answeringSpecificityFollowUp) {
    if (looksLikeMisplacedNonGrudgeMoment4Answer(params.userAnswerText)) return false;
    return true;
  }
  if (!looksLikeMoment4GrudgePrompt(params.lastAssistantContent)) return false;
  if (looksLikeMisplacedNonGrudgeMoment4Answer(params.userAnswerText)) return false;
  return true;
}

function transcriptHasSubstantiveUserAnswerAfterMoment4Grudge(
  messages: ReadonlyArray<{ role: string; content?: string | null }>,
): boolean {
  let lastGrudgeIdx = -1;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'assistant' && looksLikeMoment4GrudgePrompt(m.content ?? '')) {
      lastGrudgeIdx = i;
    }
  }
  if (lastGrudgeIdx < 0) return false;
  return messages.slice(lastGrudgeIdx + 1).some((m) => {
    if (m.role !== 'user') return false;
    const text = (m.content ?? '').trim();
    if (text.split(/\s+/).filter(Boolean).length < 5) return false;
    return !looksLikeMisplacedNonGrudgeMoment4Answer(text);
  });
}

/**
 * When repeat-request lands after only a neutral personal ack, replay the pending M4 commitment
 * threshold follow-up instead of the grudge prompt or the useless ack line.
 */
export function resolveMoment4ConfusionRepeatReplayFallback(
  messages: ReadonlyArray<{ role: string; content?: string | null }>,
  options: {
    currentInterviewMoment: number;
    moment4ThresholdProbeAsked: boolean;
  },
): string | null {
  if (options.currentInterviewMoment !== 4) return null;
  if (options.moment4ThresholdProbeAsked) return null;
  if (transcriptIncludesMoment4ThresholdAssistant(messages)) return null;
  if (!transcriptHasSubstantiveUserAnswerAfterMoment4Grudge(messages)) return null;
  return MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;
}

