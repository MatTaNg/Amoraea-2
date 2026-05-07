/**
 * After resume / re-entry prompt: classify whether the user wants verbatim TTS replay vs continue.
 * Ambiguous callers may still bias toward repeat elsewhere — this function only scores the utterance.
 */
export function classifyResumeRepeatIntent(text: string): 'repeat' | 'continue' | 'ambiguous' {
  const t = text.trim().toLowerCase();
  if (!t) return 'ambiguous';
  const repeatStrongHints =
    /\b(repeat|again|say it|remind|recap|tell me (again|one more)|what you (just )?said|last said|re-?say|replay|hear (it |that )?again)\b/;
  const repeatWeakHints = /\b(yes|yeah|yep|sure|please|ok|okay)\b/;
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  const wantsRepeat = repeatStrongHints.test(t) || (repeatWeakHints.test(t) && wordCount <= 2);
  /**
   * Do **not** use a bare `don't` — it matches narrative ("I don't trust them") and wrongly routes to
   * `continue` → early return with no LLM reply (see resume gate in `processUserSpeech`).
   */
  const continueHints =
    /\b(no|nope|nah|continue|skip|i'?m good|(i am|we'?re) good|ready|go on|let'?s (go|continue)|keep going|don'?t\s+need|don'?t\s+want|don'?t\s+repeat|no thanks|i remember|we can continue|move on|next)\b/;
  const wantsContinue = continueHints.test(t);
  if (wantsRepeat && wantsContinue) return 'ambiguous';
  if (wantsRepeat) return 'repeat';
  if (wantsContinue) return 'continue';
  return 'ambiguous';
}
