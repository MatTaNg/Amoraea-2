import { isExplicitRepeatRequestPreClassification } from '@features/aria/metaCommentClassification';

/**
 * Resume welcome-back gate: classify whether the user's next turn is repeat/continue vs a substantive answer.
 */
export function looksLikeRepeatCueInAmbiguousReply(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  if (wordCount > RESUME_GATE_LONG_ANSWER_WORD_THRESHOLD) return false;
  /** Bare "said" matches narrative ("he said…") — require explicit repeat phrasing only. */
  return /\b(you said|what you said|what did you say|say that|said that|say it again|hear it again|repeat that|repeat what you (said|say|see|asked|meant))\b/.test(
    t
  );
}

export function looksLikeDirectResumeAnswer(userText: string, lastQuestionText: string | null): boolean {
  const t = userText.trim();
  if (!t) return false;
  const lowered = t.toLowerCase();
  const words = lowered.split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;
  const metaOnly =
    /\b(repeat|again|continue|ready|i'?m good|im good|no thanks|yes please|say that again|what did you say)\b/i;
  if (words.length <= 18 && metaOnly.test(lowered)) return false;
  const hasAnswerShape =
    /\b(i|we|he|she|they|because|would|should|could|if|when|then|feel|felt|think|believe|probably|maybe)\b/i.test(
      lowered
    );
  if (!hasAnswerShape) return false;
  const lastQ = (lastQuestionText ?? '').toLowerCase().trim();
  if (!lastQ) return words.length >= 8;
  const stop = new Set([
    'what', 'when', 'where', 'which', 'would', 'could', 'should', 'have', 'from', 'with', 'that', 'this', 'your',
    'their', 'about', 'into', 'just', 'then', 'than', 'them', 'they', 'been', 'were', 'because', 'there', 'after',
    'before', 'while', 'ready', 'continue', 'repeat', 'said', 'last', 'like', 'does', 'did', 'feel', 'felt',
  ]);
  const qTokens = lastQ
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stop.has(w));
  if (qTokens.length === 0) return words.length >= 8;
  const overlap = qTokens.filter((w) => lowered.includes(w)).length;
  if (overlap >= 1) return true;
  /**
   * After resume welcome, `lastQuestionText` is often welcome-back meta or a stale probe,
   * so lexical overlap with a real scenario answer can be zero (e.g. 13-word Daniel answer
   * vs "How do you think this situation could be repaired?"). Still treat mid-length
   * narrative turns as substantive so we do not silently drop the turn.
   */
  return words.length >= 8;
}

/** Long turns after welcome-back are substantive answers — never verbatim replay. */
export const RESUME_GATE_LONG_ANSWER_WORD_THRESHOLD = 18;

export function shouldBypassResumeRepeatGateForLongAnswer(wordCount: number): boolean {
  return wordCount > RESUME_GATE_LONG_ANSWER_WORD_THRESHOLD;
}

/** Substantive mic turn after resume welcome — process normally instead of blocking on repeat-choice gate. */
export function shouldTreatTranscriptAsResumeGateSubstantiveBypass(
  userText: string,
  wordCount: number,
  lastQuestionText: string | null | undefined,
): boolean {
  if (shouldBypassResumeRepeatGateForLongAnswer(wordCount)) return true;
  return looksLikeDirectResumeAnswer(userText, lastQuestionText ?? null);
}

/** Allow explicit repeat requests and substantive answers through while repeat-choice is pending. */
export function shouldAllowResumeRepeatChoiceTurnProcessing(
  userText: string,
  wordCount: number,
  lastQuestionText: string | null | undefined,
): boolean {
  if (isExplicitRepeatRequestPreClassification(userText)) return true;
  return shouldTreatTranscriptAsResumeGateSubstantiveBypass(userText, wordCount, lastQuestionText ?? null);
}
