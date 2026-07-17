/**
 * Mid-interview offer to re-read the active question after content confusion
 * ("I don't understand", "no question was asked", etc.).
 */

let pendingSessionId: string | null = null;

export const CONFUSION_REPEAT_OFFER_LINE =
  'No worries — want me to repeat the question?';

export const CONFUSION_REPEAT_OFFER_DECLINE_ACK_LINE = 'Okay — take your time.';

export function setConfusionRepeatOfferPending(sessionId: string | null | undefined): void {
  pendingSessionId = sessionId?.trim() ? sessionId : null;
}

export function isConfusionRepeatOfferPending(sessionId: string | null | undefined): boolean {
  return !!sessionId && pendingSessionId === sessionId;
}

export function clearConfusionRepeatOfferPending(): void {
  pendingSessionId = null;
}

/** Patterns for confusion about question *content* (not an explicit "repeat that" ask). */
const QUESTION_CONTENT_CONFUSION_RES: RegExp[] = [
  /\bi don'?t (quite )?understand the question\b/i,
  /\bi don'?t (quite )?get the question\b/i,
  /\bi'?m (not|a little) (sure|clear) (what|on what) (you'?re|you are) asking\b/i,
  /\bwhat (are you|do you) (asking|looking for)\b/i,
  /\bwhat do you mean\b/i,
  /\b(can you|could you) explain\b/i,
  /\bwhat does that mean\b/i,
  /\b(clarify|rephrase).{0,40}(question|that)\b/i,
  /\bcan you (say|put) that (another way|differently)\b/i,
  /\b(no|wasn'?t|was not|never|didn'?t|did not)\s+(a\s+)?question\s+(was\s+)?(asked|said)\b/i,
  /\byou (didn'?t|did not|never)\s+(ask|asked|say|said)\s+(a\s+)?question\b/i,
  /\b(there was|there'?s|theres)\s+no\s+question\b/i,
  /\bi (didn'?t|did not)\s+(hear|get|catch)\s+(a\s+)?question\b/i,
  /\bwhat('?s| is)\s+the\s+question\s*(supposed to be)?\b/i,
  /\bi'?m confused\b/i,
  /\bthat (doesn'?t|does not|didn'?t|did not)\s+make sense\b/i,
  /\bi'?m lost\b/i,
];

export function looksLikeQuestionContentConfusion(text: string): boolean {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 28) return false;
  return QUESTION_CONTENT_CONFUSION_RES.some((re) => re.test(t));
}

export function looksLikeConfusionRepeatOfferAssent(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 8) return false;
  return /^(yes|yeah|yep|yup|sure|ok|okay|please|repeat)([\s.,!?].*)?$/i.test(t)
    || /\b(yes|yeah|yep|sure|please).{0,12}\b(repeat|question)\b/i.test(t)
    || /\brepeat\b/i.test(t);
}

export function looksLikeConfusionRepeatOfferDecline(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 8) return false;
  return /^(no|nope|nah|no thanks)([\s.,!?].*)?$/i.test(t)
    || /\b(no|don'?t)\s+(thanks|need|want)?\b/i.test(t)
    || /\bi'?m good\b/i.test(t);
}
