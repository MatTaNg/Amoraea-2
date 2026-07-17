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
