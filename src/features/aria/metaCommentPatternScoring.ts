import {
  CONFUSION_REPEAT_REQUEST_RES,
  isConfusionRepeatRequestText,
} from './metaCommentConfusionRepeat';
import { SUFFICIENCY_CHALLENGE_FRUSTRATION_RES } from './metaCommentSkipFrustration';
import { getInabilitySubstantiveOverrideDetail } from './metaCommentInabilityOverride';
import type {
  MetaCommentClassification,
  MetaCommentType,
} from '@features/aria/metaCommentClassificationTypes';

export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/** Strong frustration / resistance signals (impatience, pushback — not mere clarification). */
const FRUSTRATION_RES: RegExp[] = [
  /\bi don't know what you want\b/i,
  /\bwhat do you want from me\b/i,
  /\bwhy do you keep (asking|going)\b/i,
  /\b(you )?keep asking\b/i,
  /\b(this doesn'?t make sense|makes no sense)\b/i,
  /\bi don'?t understand what you'?re asking\b/i,
  /\b(stop (asking|this)|enough already)\b/i,
  /\b(this is (ridiculous|pointless|a waste))\b/i,
  /\b(i'?m (done|over this)|not doing this)\b/i,
  /\bfrustrated\b/i,
  /\bimpatient\b/i,
  ...SUFFICIENCY_CHALLENGE_FRUSTRATION_RES,
];

/** Genuine confusion about the question (clarification request). */
const CONFUSION_RES: RegExp[] = [
  /\bwhat are you looking for\b/i,
  /\bwhat do you mean\b/i,
  /\bi'?m not sure what you'?re asking\b/i,
  /\b(can you explain|could you explain)\b/i,
  /\bwhat does that mean\b/i,
  /\b(clarify|rephrase).{0,40}(question|that)\b/i,
  /\bi don'?t (quite )?understand the question\b/i,
  /\bi don'?t (quite )?get the question\b/i,
  /\bcan you (say|put) that (another way|differently)\b/i,
  /\b(no|wasn'?t|was not|never|didn'?t|did not)\s+(a\s+)?question\s+(was\s+)?(asked|said)\b/i,
  /\byou (didn'?t|did not|never)\s+(ask|asked|say|said)\s+(a\s+)?question\b/i,
  /\b(there was|there'?s|theres)\s+no\s+question\b/i,
  /\bi (didn'?t|did not)\s+(hear|get|catch)\s+(a\s+)?question\b/i,
  /\bi'?m confused\b/i,
  /\bthat (doesn'?t|does not|didn'?t|did not)\s+make sense\b/i,
  /\bi'?m lost\b/i,
];

/**
 * User asks to advance / skip / refuse — confirmation-only skip path (priority class).
 */
const SKIP_REQUEST_RES: RegExp[] = [
  /\bwhat\s*('s| is)\s*(the\s*)?next\s*(question|one)?\b/i,
  /\bwhat\s*'s\s+next\b/i,
  /\bwhat\s+is\s+next\b/i,
  /\bwhat\s+comes\s+next\b/i,
  /\bwhat\s+do\s+we\s+do\s+next\b/i,
  /\bwhat\s+(happens|do\s+i\s+do)\s+next\b/i,
  /\b(can\s+we|let'?s)\s+move\s+on\s+to\s+(the\s*)?(next|another)\b/i,
  /\bmove\s+on\s+to\s+(the\s*)?(next|another)\b/i,
  /\bnext\s+question\s*(please)?\b/i,
  /\bjust\s+give\s+me\s+(the\s*)?(next\s*)?(one|question)\b/i,
  /\bgive\s+me\s+(the\s*)?next\s*(one|question)?\b/i,
  /\b(can\s+we\s+)?go\s+to\s+(the\s*)?next\b/i,
  /\bskip\s+to\s+(the\s*)?next\b/i,
  /\b(can\s+we|could\s+we)\s+go\s+to\s+the\s+next\s+one\b/i,
  /\bi\s+want\s+to\s+move\s+on\b/i,
  /\b(can\s+we|could\s+we)\s+move\s+on\b/i,
  /\blet'?s\s+move\s+on\b/i,
  /\bjust\s+move\s+on\b/i,
  /\b(pass|skip)(\s+it|\s+this(\s+one)?|\s+on\s+this)?\b/i,
  /\bi'?ll\s+pass\b/i,
  /\bpass\s+on\s+this\b/i,
  /\bskip\s+(this|it)\b/i,
  /\b^n(ext)?\.?\s*$/i,
  /\bnext\s+one\b/i,
  /\b^(next|skip)\b/i,
  /\bi\s+don'?t\s+want\s+to\s+answer\s+that\b/i,
  /\bi'?d\s+rather\s+not\s+(answer|say)\b/i,
  /\bi'?d\s+rather\s+not\b/i,
  /\bi\s+don'?t\s+want\s+to\s+talk\s+about\s+that\b/i,
  /\bi\s+don'?t\s+feel\s+comfortable\s+answering\b/i,
  /\bthat'?s\s+(personal|private)\b/i,
  /\bi'?d\s+prefer\s+not\s+to\b/i,
  /\bi'?m\s+not\s+going\s+to\s+answer\s+that\b/i,
];

/** User believes they already answered — verified client-side against transcript. */
const ALREADY_ANSWERED_RES: RegExp[] = [
  /\bi\s+already\s+said\s+that\b/i,
  /\bi\s+already\s+answered\s+that\b/i,
  /\bi\s+already\s+answered\s+this\b/i,
  /\bdidn'?t\s+i\s+already\s+answer\b/i,
  /\bdid\s+i\s+already\s+answer\b/i,
  /\bi\s+already\s+said\s+what\s+i\s+think\b/i,
  /\bi\s+think\s+i\s+covered\s+that\b/i,
  /\bi\s+said\s+everything\s+i\s+have\s+to\s+say\b/i,
  /\bi\s+already\s+told\s+you\b/i,
  /\bi\s+just\s+told\s+you\b/i,
  /\bi\s+just\s+said\s+that\b/i,
];

/**
 * Genuine inability to answer — not refusal (handled separately). Narrow overlaps with frustration phrases.
 */
export const INABILITY_RES: RegExp[] = [
  /\bi\s+(honestly\s+)?have\s+no\s+idea\b/i,
  /\bi\s+got\s+nothing\b/i,
  /\bnothing\s+comes\s+to\s+mind\b/i,
  /\bi'?m\s+drawing\s+a\s+blank\b/i,
  /\bi\s+can'?t\s+think\s+of\s+anything\b/i,
  /\bi\s+don'?t\s+really\s+have\s+an\s+example\b/i,
  /\bi\s+don'?t\s+have\s+an\s+answer\b/i,
  /\bi\s+don'?t\s+know\s+what\s+to\s+say\b/i,
  /\bi\s+don'?t\s+know\s+how\s+to\s+answer\b/i,
  /\bi'?m\s+not\s+sure\s+how\s+to\s+answer\b/i,
  /\bthat'?s\s+a\s+hard\s+one\b/i,
  /^\s*i'?m\s+not\s+sure\.?\s*$/i,
  /^\s*i'?m\s+not\s+quite\s+sure\.?\s*$/i,
  /^\s*i\s+don'?t\s+know\.?\s*$/i,
  /\bi\s+don'?t\s+know(?!\s+what\s+you\s+want)\b/i,
  /\bi'?m\s+not\s+(?:quite\s+)?sure(?!\s+what\s+you'?re\s+asking)\b/i,
];

/** Same patterns as {@link INABILITY_RES} minus the "that's a hard one" hedge (see {@link metaScores}). */
const INABILITY_RES_WITHOUT_THATS_HARD_ONE_HEDGE = INABILITY_RES.filter(
  (re) => re.source !== /\bthat'?s\s+a\s+hard\s+one\b/i.source
);

/** Checking whether their answer registered / was enough. */
const CHECKING_IN_RES: RegExp[] = [
  /\bwas that enough\b/i,
  /\bdid you hear me\b/i,
  /\bis that okay\b/i,
  /\bwas that right\b/i,
  /\bdid you get that\b/i,
  /\bam i done\b/i,
  /\bdoes that work (for you)?\b/i,
  /\bis that (what you (wanted|needed))\b/i,
  /\bwas that (good|okay|alright)\b/i,
];

export function patternScore(text: string, patterns: RegExp[]): number {
  const hits = patterns.reduce((n, re) => (re.test(text) ? n + 1 : n), 0);
  if (hits === 0) return 0;
  return Math.min(1, 0.45 + hits * 0.22);
}

const THRESH = 0.5;
export const WEAK_THRESHOLD = 0.35;

export function skipRequestScore(text: string): number {
  const t = text.trim();
  if (!t || wordCount(t) > 22) return 0;
  return patternScore(t, SKIP_REQUEST_RES);
}

export const PRIORITY_ORDER: MetaCommentType[] = [
  'skip_request',
  'already_answered',
  'inability',
  'frustration',
  'checking_in',
  'confusion',
];

export function metaScores(text: string): Record<MetaCommentType, number> {
  const t = text.trim();
  const wc = wordCount(t);
  const frustration = patternScore(t, FRUSTRATION_RES);
  let confusion = patternScore(t, CONFUSION_RES);
  const repeatRequestScore = patternScore(t, CONFUSION_REPEAT_REQUEST_RES);
  if (repeatRequestScore > 0) {
    confusion = Math.max(confusion, repeatRequestScore, 0.62);
  }
  if (/\bi don'?t understand\b/i.test(t) && frustration < THRESH) {
    confusion = Math.max(confusion, 0.48);
  }
  let checking = patternScore(t, CHECKING_IN_RES);

  const checkingPhraseBoost =
    /\b(enough)\s*\?/i.test(t) && /\b(was|is|wasn'?t|isn'?t|did|does)\b/i.test(t);
  const checkingAdj = checkingPhraseBoost ? Math.max(checking, 0.52) : checking;

  let inability = patternScore(t, INABILITY_RES);
  /** "That's a hard one…" is often a verbal hedge before substantive fiction engagement — do not treat as inability alone. */
  if (wc >= 22 && /\bthat'?s\s+a\s+hard\s+one\b/i.test(t)) {
    inability = patternScore(t, INABILITY_RES_WITHOUT_THATS_HARD_ONE_HEDGE);
  }
  if (/\b(honestly\s+)?(i\s+)?(have\s+)?no\s+idea\s+what\s+to\s+say\b/i.test(t)) {
    inability = Math.max(inability, 0.72);
  }
  if (/\bdrawing\s+a\s+blank\b/i.test(t) || /\bnothing\s+comes\s+to\s+mind\b/i.test(t)) {
    inability = Math.max(inability, 0.58);
  }
  if (getInabilitySubstantiveOverrideDetail(t)) {
    inability = 0;
  }

  /** Strong frustration lines suppress overlapping inability hits. */
  if (/\bi don'?t know what you want\b/i.test(t)) {
    inability *= 0.25;
  }

  return {
    skip_request: skipRequestScore(t),
    already_answered: patternScore(t, ALREADY_ANSWERED_RES),
    inability,
    frustration,
    confusion,
    checking_in: checkingAdj,
    ambiguous_short: 0,
  };
}

export function pickMetaFromScores(scores: Record<MetaCommentType, number>): MetaCommentType | null {
  for (const kind of PRIORITY_ORDER) {
    if (scores[kind] >= THRESH) return kind;
  }
  return null;
}

export function withConfusionSubtype(
  classification: MetaCommentClassification | null,
  originalTrimmed: string
): MetaCommentClassification | null {
  if (classification?.type === 'confusion' && isConfusionRepeatRequestText(originalTrimmed)) {
    return { ...classification, confusion_subtype: 'repeat_request' };
  }
  return classification;
}
