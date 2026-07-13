export function isClosingQuestion(text: string): boolean {
  if (!text?.trim()) return false;
  const t = text.toLowerCase();
  const patterns = [
    'is there anything about that situation',
    "anything you'd want me to know",
    "anything about that situation you'd want me to know",
    "anything you'd want to add before we move on",
    'anything else about that one before',
    'before we move on',
    'before we move forward',
    "anything you'd want me to understand",
    'anything else about that one you',
    'before we go to the next one',
  ];
  return patterns.some((p) => t.includes(p.toLowerCase()));
}

/** Removes control tokens from AI response before display or TTS. Use raw text for logic only. */
export function stripControlTokens(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[INTERVIEW_COMPLETE\]/gi, '')
    .replace(/\[SCENARIO_COMPLETE:\s*\d+\]/gi, '')
    .replace(/\[\s*SCENARIO(?:_COMPLETE)?(?::\s*\d*)?[^\]]*$/gi, '')
    .replace(/\[CLOSING_QUESTION:\d+\]/gi, '')
    .replace(/\[STAGE_[123]_COMPLETE\]/g, '')
    .replace(/\[PROBE_TRIGGERED\]/gi, '')
    .replace(/\[SKEPTICISM_CHECK\]/gi, '')
    .replace(/\[\s*$/g, '')
    .trim();
}

/** Collapses whitespace and punctuation for consecutive duplicate TTS suppression (before generation/retry). */
export function normalizeTtsTextForConsecutiveDedup(text: string): string {
  const flat = stripControlTokens(text).trim().toLowerCase();
  if (!flat) return '';
  return flat.replace(/\s+/g, ' ').replace(/[^\p{L}\p{N}]/gu, '');
}

/** Multi-word / distinctive decline fragments — substring match is OK. Never use bare `"no"` here: `includes("no")` hits "not", "now", "know", etc. */
const DECLINE_PHRASE_SUBSTRINGS = [
  "i can't think of one",
  "i cant think of one",
  "i don't know",
  "i dont know",
  "nothing comes to mind",
  "not really",
  "nope",
  "can't think of anything",
  "can't think of a time",
  "can't point to someone",
  "can't point to anyone",
  "not holding on to anything",
  "don't have anyone",
  "don't have anybody",
  "don't have one",
  "don't have anything",
  "dont have anyone",
  "cant think",
  "no example",
];

/** "no" inside substantive answers (e.g. "no active bitterness") is not a decline. */
const SUBSTANTIVE_NO_PHRASES = [
  'no one',
  'no longer',
  'no active',
  'no grudge',
  'no bitterness',
  'no resentment',
  'not the same',
];

function bareNoLooksLikeDecline(lower: string, wordCount: number): boolean {
  if (!/\bno\b/i.test(lower)) return false;
  if (wordCount >= 25) return false;
  if (SUBSTANTIVE_NO_PHRASES.some((phrase) => lower.includes(phrase))) return false;
  return true;
}

export function userTextLooksLikeDecline(lower: string, options?: { wordCountHint?: number }): boolean {
  if (DECLINE_PHRASE_SUBSTRINGS.some((phrase) => lower.includes(phrase))) return true;
  const wordCount = options?.wordCountHint ?? lower.split(/\s+/).filter(Boolean).length;
  /** Standalone "no" / "no thanks" on short answers — `\b` avoids "not", "now", "nothing", … */
  return bareNoLooksLikeDecline(lower, wordCount);
}

export function isDecline(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (lower.length < 15) return true;
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  return userTextLooksLikeDecline(lower, { wordCountHint: wordCount });
}

/** Moment 4 commitment follow-up must still fire on short analytical answers; only explicit pass phrases or empty utterances skip. */
export function isExplicitPassForMoment4CommitmentFollowUp(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (lower.length < 2) return true;
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  /** Substantive grudge narratives are never an explicit pass even when they contain decline fragments. */
  if (wordCount >= 20) return false;
  return userTextLooksLikeDecline(lower, { wordCountHint: wordCount });
}
