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

/** Same bar as `AriaScreen` `looksLikeMoment4ThresholdQuestion` — keep in sync (work through / walk away / point). */
function looksLikeMoment4ThresholdQuestionText(tRaw: string): boolean {
  const t = (tRaw ?? '').toLowerCase();
  return (
    t.includes('"at what point do you decide when a relationship is something to work through versus something you need to walk away from?"') ||
    (t.includes('work through') && t.includes('walk away') && t.includes('point'))
  );
}

/** True when the last assistant turn is the grudge/dislike question (or full Moment 4 handoff), not threshold or appreciation. */
export function looksLikeMoment4GrudgePrompt(text: string): boolean {
  const t = (text ?? '').toLowerCase();
  if (looksLikeMoment4ThresholdQuestionText(t)) return false;
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
 * User answered as if still in Scenario C (Theo/Morgan / couples therapy) instead of the personal grudge prompt.
 * Do not inject the commitment follow-up until they address the grudge question — let the model redirect.
 */
export function looksLikeMisplacedNonGrudgeMoment4Answer(text: string): boolean {
  const t = (text ?? '').toLowerCase().trim();
  if (t.length < 35) return false;
  const hasTheo = /\btheo\b/.test(t);
  const hasMorgan = /\bmorgan\b/.test(t);
  const scenarioCStyleMisread =
    (hasTheo && hasMorgan) ||
    ((hasTheo || hasMorgan) && /\b(couples therapy|recurring argument)\b/.test(t));
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
}): boolean {
  if (!params.isMoment4 || params.probeAlreadyAsked) return false;
  if (!looksLikeMoment4GrudgePrompt(params.lastAssistantContent)) return false;
  if (looksLikeMisplacedNonGrudgeMoment4Answer(params.userAnswerText)) return false;
  return true;
}

