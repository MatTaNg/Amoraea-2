import type { MetaCommentClassification } from './metaCommentClassificationTypes';

/**
 * User wants the actual question re-read — not reframing / elaboration probes.
 * Boosts confusion score in {@link metaScores}.
 */
export const CONFUSION_REPEAT_REQUEST_RES: RegExp[] = [
  /\bcan you repeat the questions?\b/i,
  /\bcan you repeat that\b/i,
  /\bcan you say that again\b/i,
  /\bwhat was the question\b/i,
  /\bwhat did you ask\b/i,
  /\bi didn'?t catch that\b/i,
  /\bsorry,?\s*what was that\b/i,
  /\bcan you ask that again\b/i,
  /\bwhat was that again\b/i,
  /\brepeat that please\b/i,
  /\b(say|run) (that|it) again\b/i,
  /\bcome again\b/i,
  /\brepeat the question\b/i,
  /\b(yes|yeah|yep|sure),?\s+repeat\b/i,
  /\brepeat\s+what you (said|say|see|asked|meant)\b/i,
  /\bplease\s+repeat\b/i,
];

export function isConfusionRepeatRequestText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return CONFUSION_REPEAT_REQUEST_RES.some((re) => re.test(t));
}

/**
 * Unambiguous repeat-request phrases — checked before the general classifier so short clear
 * utterances are never downgraded to `ambiguous_short` (word count is irrelevant).
 */
const EXPLICIT_REPEAT_REQUEST_PRECLASS_RES: RegExp[] = [
  /\brepeat the questions?\b/i,
  /\bask the questions? again\b/i,
  /\bsay that again\b/i,
  /\bcan you repeat\b/i,
  /\bwhat did you say\b/i,
  /\bdidn'?t hear you\b/i,
  /\bdidn'?t catch that\b/i,
  /\bsay it again\b/i,
  /\bone more time\b/i,
  /\bcome again\b/i,
  /\bsorry\s+what\b/i,
  /\bpardon\b/i,
  /\bhuh\b/i,
  /\b(yes|yeah|yep|sure),?\s+repeat\b/i,
  /\b(yes|yeah|yep|sure),?\s+repeat what you said\b/i,
  /\brepeat\w* what you (said|just said)\b/i,
  /\brepeat\s+what you (said|say|see|asked|meant)\b/i,
  /\bplease\s+repeat\b/i,
  /^\s*repeat\s*$/i,
];

export function isExplicitRepeatRequestPreClassification(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return EXPLICIT_REPEAT_REQUEST_PRECLASS_RES.some((re) => re.test(t));
}

export function classifyExplicitRepeatRequestPreClassification(
  text: string
): MetaCommentClassification | null {
  if (!isExplicitRepeatRequestPreClassification(text)) return null;
  return { type: 'confusion', confidence: 1.0, confusion_subtype: 'repeat_request' };
}
