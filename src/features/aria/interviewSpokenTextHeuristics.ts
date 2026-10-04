import { stripControlTokens } from '@features/aria/interviewControlTokens';

const MIN_SPOKEN_TEXT_CHARS = 12;

/** True when text looks like a short in-scenario probe (not a vignette/handoff bundle). */
export function looksLikeShortProbeFallback(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < MIN_SPOKEN_TEXT_CHARS) return false;
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

/** True when text is a brief stream acknowledgement. */
export function looksLikeBriefStreamAckOnly(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t || t.length > 40) return false;
  return /^(makes sense|got it|okay|ok|alright|all right|mm-?hmm|yeah|right)\.?$/i.test(t);
}

/**
 * Standalone receipt ("Makes sense.", "That makes a lot of sense.") with no question after it.
 * Scenario-complete handoffs already open with their own acknowledgement.
 */
export function isAckOnlySentenceBeforeScenarioBoundary(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 80 || /\?\s*$/.test(t)) return false;
  if (looksLikeBriefStreamAckOnly(t)) return true;
  if (
    /^(?:got it|okay|ok|fair|thanks|thank you|sure|absolutely|right|understood|alright|makes sense|that makes sense|that makes a lot of sense|well done|i'm with you|i am with you)\s*[.!?…]?\s*$/i.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

/** True when text is a suppressed post-repair S1 paraphrase. */
export function isUnauthorizedS1FollowUp(text: string): boolean {
  const t = stripControlTokens(text)
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
  return /\bwhat do you think emma\b/.test(t) && !/\b(very clear|made that very clear)\b/.test(t);
}

/** True when text contains a later scenario vignette or boundary lead. */
/**
 * Scenario-close speech. A short "Got it." in front of this is a second acknowledgement.
 */
export function isScenarioEndHandoffSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (/\bthat['’]?s the end of this scenario\b/i.test(t)) return true;
  if (/\bhere'?s the next situation\b/i.test(t)) return true;
  if (/\bgood work\b/i.test(t) && /\b(?:end of this scenario|next situation)\b/i.test(t)) return true;
  if (/\bsarah\b/i.test(t) && /\bjames\b/i.test(t)) return true;
  return looksLikeScenarioHandoffOrVignetteBundle(t);
}

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
