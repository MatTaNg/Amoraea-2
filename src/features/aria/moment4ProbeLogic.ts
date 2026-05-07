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
  const workVsLeaveFork =
    /\bwork(?:ing)? through\b/.test(t) &&
    /\bwalk away\b/.test(t) &&
    (/\b(at what point|what point|when (?:do you|would you|have you|did you) decide)\b/.test(t) ||
      /\b(decide (?:if|whether)|worth working through|stay and work|leave or stay)\b/.test(t) ||
      t.includes('point'));
  return canonicalPhrase || workVsLeaveFork;
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
    if (msgsPriorToCurrentUser[j].role === 'user') return false;
  }
  return true;
}

/** True when the last assistant turn is the grudge/dislike question (or full Moment 4 handoff), not threshold or appreciation. */
export function looksLikeMoment4GrudgePrompt(text: string): boolean {
  if (looksLikeMoment4ThresholdQuestion(text)) return false;
  const t = (text ?? '').toLowerCase();
  if (t.includes('think of a time you really celebrated someone') || (t.includes('really celebrated') && t.includes('your life'))) {
    return false;
  }
  return (
    t.includes('held a grudge') ||
    (t.includes("really didn't like") && (t.includes('someone') || t.includes('your life'))) ||
    (t.includes('grudge') && t.includes('someone'))
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
  if (params.answeringSpecificityFollowUp) {
    if (looksLikeMisplacedNonGrudgeMoment4Answer(params.userAnswerText)) return false;
    return true;
  }
  if (!looksLikeMoment4GrudgePrompt(params.lastAssistantContent)) return false;
  if (looksLikeMisplacedNonGrudgeMoment4Answer(params.userAnswerText)) return false;
  return true;
}

