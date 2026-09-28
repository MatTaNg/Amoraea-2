function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/** User pushback that their prior turn should count — routes to client-owned gates. */
export type PriorAnswerMetaKind = 'sufficiency_check_in' | 'already_answered_claim';

function normalizeMetaUtterance(text: string): string {
  return (text ?? '').trim().replace(/\s+/g, ' ');
}

/**
 * Short turn asking whether a prior substantive answer was sufficient / heard.
 * Examples: "Was that enough?", "Wasn't that enough?", "Did you get that?"
 */
export function looksLikeSufficiencyCheckInShape(text: string): boolean {
  const t = normalizeMetaUtterance(text);
  if (!t || wordCount(t) > 12) return false;

  const hasSufficiencyCue =
    /\b(enough|sufficient|answer(ed)? it|got that|get that|hear me|did you hear|am i done)\b/i.test(
      t,
    );
  const hasCheckInFrame =
    /\b(was|is|wasn'?t|isn'?t|ain'?t|did|does|do|am|are|that|this)\b/i.test(t) || /\?\s*$/.test(t);

  return hasSufficiencyCue && hasCheckInFrame;
}

/**
 * User asks the interviewer to verify / re-read their prior answer (no "already" claim).
 * Examples: "Check my answer", "Check my last answer", "Did you hear what I said?"
 */
export function looksLikeVerifyPriorAnswerShape(text: string): boolean {
  const t = normalizeMetaUtterance(text);
  if (!t || wordCount(t) > 14) return false;

  const asksToVerify =
    /\b(check|look at|see|read|review|go back to|look back at)\b/i.test(t) ||
    /\bdid you (hear|get|catch)\b/i.test(t);
  const referencesPrior =
    /\b(my\s+)?(last\s+)?(answer|response|what i said|prior answer)\b/i.test(t) ||
    /\bwhat i (just\s+)?said\b/i.test(t);

  return asksToVerify && referencesPrior;
}

/**
 * User claims they already answered the active question — not a sufficiency check.
 * Examples: "Didn't I answer that already?", "I already answered that", "I told you already"
 */
export function looksLikeAlreadyAnsweredShape(text: string): boolean {
  const t = normalizeMetaUtterance(text);
  if (!t || wordCount(t) > 16) return false;

  // Flexible word order: "answer … already" / "already … answer"
  if (/\banswer(ed)?\b[\s\S]{0,40}\balready\b/i.test(t)) return true;
  if (/\balready\b[\s\S]{0,40}\b(answer(ed)?|said|told|covered)\b/i.test(t)) return true;

  const hasAlreadyCue = /\b(already|just|before|earlier|thought|told you)\b/i.test(t);
  const hasAnswerCue =
    /\b(answer(ed)?|said|told|covered|this question|that question|that one|what i said)\b/i.test(
      t,
    );

  return hasAlreadyCue && hasAnswerCue;
}

/** High-confidence explicit patterns — kept minimal; shape detectors cover variants. */
const PRIOR_ANSWER_EXPLICIT_ALREADY: RegExp[] = [
  /\bi\s+already\s+(said|answered|told)\b/i,
  /\b(didn'?t|did)\s+i\s+(already\s+)?answer\b/i,
  /\bi\s+(just|already)\s+(said|told)\b/i,
  /\bi\s+thought\s+i\s+already\s+answered\b/i,
];

const PRIOR_ANSWER_EXPLICIT_SUFFICIENCY: RegExp[] = [
  /\bwasn'?t that enough\b/i,
  /\bwas that enough\b/i,
  /\bdid you get that\b/i,
  /\bdid you hear me\b/i,
];

export function looksLikeAlreadyAnsweredClaim(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  if (PRIOR_ANSWER_EXPLICIT_ALREADY.some((re) => re.test(t))) return true;
  return looksLikeAlreadyAnsweredShape(t);
}

export function looksLikeCheckingInSufficiencyAsk(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  if (PRIOR_ANSWER_EXPLICIT_SUFFICIENCY.some((re) => re.test(t))) return true;
  return looksLikeSufficiencyCheckInShape(t);
}

/**
 * Classify prior-answer meta turns for gate routing.
 * Sufficiency / verify-without-already → checking-in gate.
 * Already-answered claims → already-answered advance gate.
 */
export function classifyPriorAnswerMetaKind(text: string): PriorAnswerMetaKind | null {
  const t = (text ?? '').trim();
  if (!t) return null;

  if (looksLikeCheckingInSufficiencyAsk(t)) {
    return 'sufficiency_check_in';
  }

  if (looksLikeVerifyPriorAnswerShape(t) && !looksLikeAlreadyAnsweredShape(t)) {
    return 'sufficiency_check_in';
  }

  if (looksLikeAlreadyAnsweredClaim(t)) {
    return 'already_answered_claim';
  }

  if (looksLikeVerifyPriorAnswerShape(t)) {
    return 'already_answered_claim';
  }

  return null;
}

export function looksLikePriorAnswerMetaComment(text: string): boolean {
  return classifyPriorAnswerMetaKind(text) != null;
}

/** Boost score for meta classifier when shape matches (avoids ambiguous_short fallback). */
export function priorAnswerMetaScoreBoost(text: string): {
  already_answered: number;
  checking_in: number;
} {
  const kind = classifyPriorAnswerMetaKind(text);
  if (kind === 'sufficiency_check_in') {
    return { already_answered: 0, checking_in: 0.58 };
  }
  if (kind === 'already_answered_claim') {
    return { already_answered: 0.62, checking_in: 0 };
  }
  return { already_answered: 0, checking_in: 0 };
}
