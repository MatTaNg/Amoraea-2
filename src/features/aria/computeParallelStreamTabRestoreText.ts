/** Removes interview control tokens before tab-restore text comparison. */
function stripInterviewControlTokens(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[INTERVIEW_COMPLETE\]/gi, '')
    .replace(/\[SCENARIO_COMPLETE:\s*\d+\]/gi, '')
    .replace(/\[CLOSING_QUESTION:\d+\]/gi, '')
    .replace(/\[STAGE_[123]_COMPLETE\]/g, '')
    .replace(/\[PROBE_TRIGGERED\]/gi, '')
    .replace(/\[SKEPTICISM_CHECK\]/gi, '')
    .trim();
}

const MIN_TAB_RESTORE_REPLAY_CHARS = 12;

/**
 * When parallel Claude streaming TTS is interrupted (tab hide), returns the text that still
 * needs to be spoken — completed sentences are stripped from `accumulatedFullText`.
 */
export function computeParallelStreamTabRestoreText(
  accumulatedFullText: string,
  spokenCompleteText: string,
  fallbacks: string[]
): string {
  const full = stripInterviewControlTokens(accumulatedFullText).trim();
  const spoken = stripInterviewControlTokens(spokenCompleteText).trim();

  if (full.length > 0 && spoken.length > 0) {
    if (full.startsWith(spoken)) {
      const remaining = full.slice(spoken.length).trim();
      if (remaining.length >= MIN_TAB_RESTORE_REPLAY_CHARS) return remaining;
    } else if (spoken.length >= full.length * 0.85) {
      /* nearly complete — fall through to in-flight sentence */
    } else {
      const prefix = spoken.slice(0, Math.min(40, spoken.length));
      const idx = full.indexOf(prefix);
      if (idx >= 0) {
        const endPos = idx + spoken.length;
        if (endPos <= full.length) {
          const remaining = full.slice(endPos).trim();
          if (remaining.length >= MIN_TAB_RESTORE_REPLAY_CHARS) return remaining;
        }
      }
    }
  }

  for (const fb of fallbacks) {
    const t = stripInterviewControlTokens(fb).trim();
    if (t.length >= MIN_TAB_RESTORE_REPLAY_CHARS) return t;
  }

  return full;
}
