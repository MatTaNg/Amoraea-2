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

/** True when text looks like a short in-scenario probe (not a vignette/handoff bundle). */
export function looksLikeShortProbeFallback(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < MIN_TAB_RESTORE_REPLAY_CHARS) return false;
  if (t.length > 280) return false;
  return (
    /\bif you were (james|ryan)\b/i.test(t) ||
    /\bhow would you repair\b/i.test(t) ||
    /\bjames could have done (?:something )?differently\b/i.test(t) ||
    (/\bryan\b/i.test(t) &&
      /\b(could'?ve done differently|could have done differently|done differently|prevent .+ escalat)/i.test(
        t,
      )) ||
    /\bwhat do you make of (?:that|emma)\b/i.test(t) ||
    /\bwhat do you think is going on here\b/i.test(t)
  );
}

/** Brief stream ack that should not win over an S1→S2 / S2→S3 handoff already spoken. */
export function looksLikeBriefStreamAckOnly(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t || t.length > 40) return false;
  return /^(makes sense|got it|okay|ok|alright|all right|mm-?hmm|yeah|right)\.?$/i.test(t);
}

/**
 * Suppressed post-repair S1 paraphrases (e.g. "What could Ryan have done differently…")
 * must never be Tap-to-continue when a scenario handoff/vignette is already in spokenComplete.
 * Kept local (no situation1ExactModalPrompt import) to avoid pulling Supabase into restore helpers.
 */
export function isUnauthorizedS1TabRestoreFollowUp(text: string): boolean {
  const t = stripInterviewControlTokens(text)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'");
  if (!t) return false;
  if (
    /\bryan\b/.test(t) &&
    /\b(done differently|could have done|could'?ve done|prevent .+ escalat|avoid this getting)\b/.test(t)
  ) {
    return true;
  }
  if (/\bhow do you think emma\b/.test(t)) return true;
  if (/\bwhat do you think emma\b/.test(t) && !/\b(very clear|made that very clear)\b/.test(t)) {
    return true;
  }
  return false;
}

/** True when accumulated stream already contains a later scenario vignette / boundary lead. */
export function looksLikeScenarioHandoffOrVignetteBundle(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return false;
  return (
    /\bsophie and daniel\b/.test(t) ||
    /\bsarah has been job hunting\b/.test(t) ||
    (/\bemma and ryan\b/.test(t) && /\bdinner\b/.test(t)) ||
    /\bsecond one done\b/.test(t) ||
    /\bone more situation and then we'?ll get personal\b/.test(t) ||
    /\bhere'?s the third situation\b/.test(t) ||
    /\bwe'?ve got two more situations\b/.test(t) ||
    /\bend of the three described situations\b/.test(t) ||
    /\bthat'?s a wrap on that one\b/.test(t)
  );
}

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

  /**
   * Client S1→S2 handoff HTML speak sets spokenComplete to the vignette bundle while
   * accumulatedFullText may still hold a suppressed Ryan follow-up. Prefer the handoff.
   */
  if (
    spoken.length >= MIN_TAB_RESTORE_REPLAY_CHARS &&
    looksLikeScenarioHandoffOrVignetteBundle(spoken) &&
    (isUnauthorizedS1TabRestoreFollowUp(full) ||
      looksLikeShortProbeFallback(full) ||
      (full.length > 0 && full.length < spoken.length * 0.6 && !looksLikeScenarioHandoffOrVignetteBundle(full)))
  ) {
    return spoken;
  }

  if (full.length > 0 && spoken.length > 0) {
    if (full.startsWith(spoken)) {
      const remaining = full.slice(spoken.length).trim();
      if (remaining.length >= MIN_TAB_RESTORE_REPLAY_CHARS) {
        if (
          looksLikeScenarioHandoffOrVignetteBundle(spoken) &&
          (isUnauthorizedS1TabRestoreFollowUp(remaining) || looksLikeShortProbeFallback(remaining))
        ) {
          return spoken;
        }
        return remaining;
      }
    } else if (spoken.length >= full.length * 0.85) {
      /* nearly complete — fall through to in-flight sentence */
    } else {
      const prefix = spoken.slice(0, Math.min(40, spoken.length));
      const idx = full.indexOf(prefix);
      if (idx >= 0) {
        const endPos = idx + spoken.length;
        if (endPos <= full.length) {
          const remaining = full.slice(endPos).trim();
          if (remaining.length >= MIN_TAB_RESTORE_REPLAY_CHARS) {
            if (
              looksLikeScenarioHandoffOrVignetteBundle(spoken) &&
              (isUnauthorizedS1TabRestoreFollowUp(remaining) || looksLikeShortProbeFallback(remaining))
            ) {
              return spoken;
            }
            return remaining;
          }
        }
      }
    }
  }

  /**
   * Canonical show-scenario-card HTML speak often leaves spokenCompleteText empty until
   * playback confirms. Prefer the accumulated handoff/vignette over a stale short probe
   * still sitting in lastQuestion / in-flight (e.g. S2 James repair while S3 is speaking).
   */
  if (
    !spoken &&
    full.length >= MIN_TAB_RESTORE_REPLAY_CHARS &&
    looksLikeScenarioHandoffOrVignetteBundle(full)
  ) {
    const shortProbeFallback = fallbacks
      .map((fb) => stripInterviewControlTokens(fb).trim())
      .find((t) => looksLikeShortProbeFallback(t) || isUnauthorizedS1TabRestoreFollowUp(t));
    if (shortProbeFallback && !looksLikeScenarioHandoffOrVignetteBundle(shortProbeFallback)) {
      return full;
    }
    if (full.length > 200) {
      return full;
    }
  }

  for (const fb of fallbacks) {
    const t = stripInterviewControlTokens(fb).trim();
    if (t.length < MIN_TAB_RESTORE_REPLAY_CHARS) continue;
    if (
      spoken.length >= MIN_TAB_RESTORE_REPLAY_CHARS &&
      looksLikeScenarioHandoffOrVignetteBundle(spoken) &&
      (isUnauthorizedS1TabRestoreFollowUp(t) ||
        looksLikeShortProbeFallback(t) ||
        looksLikeBriefStreamAckOnly(t))
    ) {
      continue;
    }
    return t;
  }

  if (
    spoken.length >= MIN_TAB_RESTORE_REPLAY_CHARS &&
    looksLikeScenarioHandoffOrVignetteBundle(spoken) &&
    (isUnauthorizedS1TabRestoreFollowUp(full) || looksLikeBriefStreamAckOnly(full))
  ) {
    return spoken;
  }

  return full;
}
