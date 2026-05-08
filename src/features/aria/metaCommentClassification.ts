/**
 * Heuristic classification of user meta-comments (frustration, confusion, checking-in, skip_request,
 * inability, already_answered, ambiguous_short) before elongating / thin-response probes.
 * Uses weighted regex hits + fixed priority when multiple categories score above threshold (see code).
 */

import { isClientAudioRecoveryAssistantLine, NON_ENGLISH_VOICE_PROMPT } from './interviewLanguageGate';

export type MetaCommentType =
  | 'frustration'
  | 'confusion'
  | 'checking_in'
  | 'skip_request'
  | 'inability'
  | 'already_answered'
  | 'ambiguous_short';

/** Confusion detected as "repeat the question" vs generic clarification — drives interviewer delivery rules. */
export type ConfusionSubtype = 'repeat_request';

export type MetaCommentClassification = {
  type: MetaCommentType;
  /** Rough confidence 0–1 for telemetry / gating */
  confidence: number;
  /** Populated when `type === 'confusion'` and the user asked to hear the question again. */
  confusion_subtype?: ConfusionSubtype;
};

function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/** Mirrors AriaScreen `stripControlTokens` for classification / delivery classification only. */
function stripControlTokensMini(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[INTERVIEW_COMPLETE\]/gi, '')
    .replace(/\[SCENARIO_COMPLETE:\d+\]/gi, '')
    .replace(/\[CLOSING_QUESTION:\d+\]/gi, '')
    .replace(/\[STAGE_[123]_COMPLETE\]/g, '')
    .replace(/\[PROBE_TRIGGERED\]/gi, '')
    .replace(/\[SKEPTICISM_CHECK\]/gi, '')
    .trim();
}

/**
 * Whether assistant text counts as a substantive interview question delivery for meta-exemption resets.
 * Infra / ratio / silent-buffer prompts are non-substantive; short meta-only acks without a question are non-substantive.
 */
export function countsAsSubstantiveInterviewQuestionDelivery(text: string): boolean {
  const raw = stripControlTokensMini(text).trim();
  if (!raw) return false;
  if (raw === NON_ENGLISH_VOICE_PROMPT.trim()) return false;
  if (isClientAudioRecoveryAssistantLine(raw)) return false;
  if (/^i only caught part of that\b/i.test(raw)) return false;
  if (/^i didn't catch any speech on that try\b/i.test(raw)) return false;
  if (/i'?m having a little trouble on my end\b/i.test(raw)) return false;
  const wc = wordCount(raw);
  /** Normal interview moves include a question mark; long transitions without `?` still count. */
  if (raw.includes('?')) return true;
  if (wc >= 22) return true;
  return false;
}

/**
 * Rhetorical sufficiency pushback — frustration re-ask + skip path.
 * Reflection-on-prior-turn must be omitted for these (mirroring reads as repeating them).
 */
const SUFFICIENCY_CHALLENGE_FRUSTRATION_RES: RegExp[] = [
  /\bwasn'?t that enough\b/i,
  /\b(isn'?t|ain'?t) that enough\b/i,
];

export function isSufficiencyChallengeFrustrationUtterance(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return SUFFICIENCY_CHALLENGE_FRUSTRATION_RES.some((re) => re.test(t));
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
  /\bcan you (say|put) that (another way|differently)\b/i,
];

/**
 * User wants the actual question re-read — not reframing / elaboration probes.
 * Boosts confusion score in {@link metaScores}.
 */
const CONFUSION_REPEAT_REQUEST_RES: RegExp[] = [
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
];

export function isConfusionRepeatRequestText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return CONFUSION_REPEAT_REQUEST_RES.some((re) => re.test(t));
}

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
  /\bi\s+already\s+said\s+what\s+i\s+think\b/i,
  /\bi\s+think\s+i\s+covered\s+that\b/i,
  /\bi\s+said\s+everything\s+i\s+have\s+to\s+say\b/i,
  /\bi\s+already\s+told\s+you\b/i,
  /\bi\s+just\s+said\s+that\b/i,
];

/**
 * Genuine inability to answer — not refusal (handled separately). Narrow overlaps with frustration phrases.
 */
const INABILITY_RES: RegExp[] = [
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
  /^\s*i\s+don'?t\s+know\.?\s*$/i,
  /\bi\s+don'?t\s+know(?!\s+what\s+you\s+want)\b/i,
  /\bi'?m\s+not\s+sure(?!\s+what\s+you'?re\s+asking)\b/i,
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

function patternScore(text: string, patterns: RegExp[]): number {
  const hits = patterns.reduce((n, re) => (re.test(text) ? n + 1 : n), 0);
  if (hits === 0) return 0;
  return Math.min(1, 0.45 + hits * 0.22);
}

const THRESH = 0.5;
const WEAK_THRESHOLD = 0.35;

function skipRequestScore(text: string): number {
  const t = text.trim();
  if (!t || wordCount(t) > 22) return 0;
  return patternScore(t, SKIP_REQUEST_RES);
}

/** Canonical skip confirmation line — client-only TTS for skip_request / inability escalation (keep in sync with AriaScreen copy). */
export const SKIP_REQUEST_CONFIRMATION_PROMPT_LINE =
  'Are you sure you want to skip this one? We can, but it may affect your score.';

/**
 * One short extract from prior user words only — for skip-request reflection and already-answered ownership.
 */
export function extractSalientReflectionClause(excerpt: string): string | null {
  const t = excerpt.trim().replace(/\s+/g, ' ');
  if (!t || wordCount(t) < 8) return null;
  const sentenceCut = t.match(/^[\s\S]{1,240}?[.!?](?:\s|$)/);
  let clause = sentenceCut ? sentenceCut[0].trim() : t.split(/\s+/).slice(0, 14).join(' ');
  clause = clause.replace(/\s+/g, ' ').trim();
  if (clause.length > 110) clause = `${clause.slice(0, 107).trim()}…`;
  return clause.length >= 12 ? clause : null;
}

export function buildSkipRequestConfirmationSpeech(args: {
  priorSubstantiveNonMetaExcerpt: string | null | undefined;
}): string {
  const clause = extractSalientReflectionClause(args.priorSubstantiveNonMetaExcerpt ?? '');
  if (!clause) return SKIP_REQUEST_CONFIRMATION_PROMPT_LINE;
  return `${clause} ${SKIP_REQUEST_CONFIRMATION_PROMPT_LINE}`;
}

const PRIORITY_ORDER: MetaCommentType[] = [
  'skip_request',
  'already_answered',
  'inability',
  'frustration',
  'checking_in',
  'confusion',
];

function metaScores(text: string): Record<MetaCommentType, number> {
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

function pickMetaFromScores(scores: Record<MetaCommentType, number>): MetaCommentType | null {
  for (const kind of PRIORITY_ORDER) {
    if (scores[kind] >= THRESH) return kind;
  }
  return null;
}

function withConfusionSubtype(
  classification: MetaCommentClassification | null,
  originalTrimmed: string
): MetaCommentClassification | null {
  if (classification?.type === 'confusion' && isConfusionRepeatRequestText(originalTrimmed)) {
    return { ...classification, confusion_subtype: 'repeat_request' };
  }
  return classification;
}

/** Prior turn counts as substantive iff ≥ minWords and classifier returns null (not a meta-comment). */
export function getPriorSubstantiveNonMetaUserContentInMoment(
  messages: Array<{
    role: string;
    content?: string;
    scenarioNumber?: number;
    interviewMoment?: number;
    isWelcomeBack?: boolean;
  }>,
  scenarioNumber: 1 | 2 | 3,
  currentMoment: number,
  minWords = 8
): string | null {
  const users = messages.filter(
    (m) =>
      m.role === 'user' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      (m as { scenarioNumber?: number }).scenarioNumber === scenarioNumber
  );
  if (users.length < 2) return null;
  const priorOnly = users.slice(0, -1);
  const hasMomentTag = priorOnly.some((m) => (m as { interviewMoment?: number }).interviewMoment != null);
  const pool = hasMomentTag
    ? priorOnly.filter((m) => (m as { interviewMoment?: number }).interviewMoment === currentMoment)
    : priorOnly;

  for (let i = pool.length - 1; i >= 0; i--) {
    const c = (pool[i].content ?? '').trim();
    if (wordCount(c) < minWords) continue;
    if (classifyUserMetaComment(c) != null) continue;
    return c;
  }
  return null;
}

/**
 * Classify meta-comment type. Runs before elongating-probe logic.
 * Uses priority order when multiple categories score ≥ 0.5. Below threshold for all categories:
 * short utterances (≤10 words) default to `ambiguous_short`; longer turns return null (normal answer).
 */
export function classifyUserMetaComment(text: string): MetaCommentClassification | null {
  const t = text.trim();
  if (!t) return null;

  const wc = wordCount(t);
  const scores = metaScores(t);
  const picked = pickMetaFromScores(scores);
  if (picked != null) {
    return withConfusionSubtype({ type: picked, confidence: Math.min(1, scores[picked]) }, t);
  }

  const bestWeak = Math.max(
    scores.frustration,
    scores.confusion,
    scores.checking_in,
    scores.inability,
    scores.already_answered,
    scores.skip_request
  );

  if (wc <= 10) {
    if (bestWeak >= WEAK_THRESHOLD) {
      const weakOrder: MetaCommentType[] = [
        'skip_request',
        'already_answered',
        'inability',
        'frustration',
        'checking_in',
        'confusion',
      ];
      for (const kind of weakOrder) {
        if (scores[kind] >= WEAK_THRESHOLD) {
          return withConfusionSubtype({ type: kind, confidence: scores[kind] }, t);
        }
      }
    }
    return withConfusionSubtype(
      { type: 'ambiguous_short', confidence: Math.max(0.35, bestWeak) },
      t
    );
  }

  return null;
}

/** True when an earlier user message in this scenario had substantive length (same scenario before current utterance). */
export function hadPriorSubstantiveAnswerInScenarioForFrustration(
  messages: Array<{
    role: string;
    content?: string;
    scenarioNumber?: number;
    isWelcomeBack?: boolean;
  }>,
  scenarioNumber: 1 | 2 | 3,
  minWords = 10
): boolean {
  const users = messages.filter(
    (m) =>
      m.role === 'user' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      (m as { scenarioNumber?: number }).scenarioNumber === scenarioNumber
  );
  if (users.length < 2) return false;
  const priorOnly = users.slice(0, -1);
  return priorOnly.some((m) => wordCount(m.content ?? '') >= minWords);
}

/** Latest substantive user message in this scenario before the current user turn (for frustration reflection). */
export function lastSubstantivePriorUserExcerptInScenario(
  messages: Array<{
    role: string;
    content?: string;
    scenarioNumber?: number;
    isWelcomeBack?: boolean;
  }>,
  scenarioNumber: 1 | 2 | 3,
  minWords = 10
): string | null {
  const users = messages.filter(
    (m) =>
      m.role === 'user' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      (m as { scenarioNumber?: number }).scenarioNumber === scenarioNumber
  );
  if (users.length < 2) return null;
  const priorOnly = users.slice(0, -1);
  for (let i = priorOnly.length - 1; i >= 0; i--) {
    const c = (priorOnly[i].content ?? '').trim();
    if (wordCount(c) >= minWords) return c;
  }
  return null;
}

/**
 * Derive a short re-ask stem from the last interviewer prompt (client fallback when the model emits an elongating probe).
 */
export function shortenLastInterviewerQuestionForFrustrationReask(lastQuestionText: string | null | undefined): string {
  const raw = stripControlTokensMini(lastQuestionText ?? '').trim();
  if (!raw || raw.length < 6) return "what you're seeing here";
  const flat = raw.replace(/\s+/g, ' ');
  const qIdx = flat.lastIndexOf('?');
  if (qIdx !== -1) {
    const cutStart = Math.max(
      flat.lastIndexOf('.', qIdx - 1),
      flat.lastIndexOf('!', qIdx - 1),
      flat.lastIndexOf('\n', qIdx)
    );
    const slice = flat.slice(cutStart < 0 ? 0 : cutStart + 1, qIdx + 1).trim().replace(/^[.!?\s]+/, '');
    if (slice.length >= 8) return slice.length > 280 ? `${slice.slice(0, 277)}…?` : slice;
  }
  const tail = flat.slice(-220).trim();
  return tail.endsWith('?') ? tail : `${tail}?`;
}

/** Deterministic assistant line when the model violates frustration-meta rules and returns only an elongating probe. */
export function buildClientFrustrationMetaFallbackAssistantText(args: {
  lastQuestionText: string | null | undefined;
  userTranscript: string;
  hadPriorSubstantiveAnswerInMoment: boolean | undefined;
  priorSubstantiveUserExcerpt: string | null | undefined;
}): string {
  const tail =
    ' We can skip this question but it may affect your score, do you still want to skip it?';
  const sufficiency = isSufficiencyChallengeFrustrationUtterance(args.userTranscript);
  const essential = shortenLastInterviewerQuestionForFrustrationReask(args.lastQuestionText);
  const core = essential.endsWith('?') ? essential.slice(0, -1).trim() : essential.trim();

  if (sufficiency || !args.hadPriorSubstantiveAnswerInMoment) {
    return `I need to know ${core}.${tail}`;
  }
  const ex = (args.priorSubstantiveUserExcerpt ?? '').trim();
  let reflect = '';
  if (ex) {
    const clip = ex.length > 110 ? `${ex.slice(0, 107).trim()}…` : ex;
    reflect = clip.endsWith('.') ? `${clip} ` : `${clip}. `;
  }
  return `${reflect}I need to know ${core}.${tail}`;
}

/** User accepted skipping after a first frustration skip offer (short utterances only). */
export function looksLikeFrustrationSkipAcceptance(text: string): boolean {
  const raw = text.trim();
  if (!raw || raw.length > 160) return false;
  const t = raw.toLowerCase();
  /** Casual "no skip" / "no, skip" means declining to skip — not "skip". */
  if (/^no\s*(,\s*)?skip\s*$/i.test(raw) && !/\blet'?s\b/i.test(t)) return false;
  if (/\b(don'?t|do not)\s+skip\b/.test(t)) return false;
  return (
    /^skip\.?$/i.test(raw) ||
    /\bskip\b/.test(t) ||
    /\blet'?s\s+skip\b/.test(t) ||
    /\bskip\s+it\b/.test(t) ||
    /\bwe\s+can\s+skip\b/.test(t) ||
    /\bi'?ll\s+skip\b/.test(t) ||
    /\bjust\s+skip\b/.test(t) ||
    /\byeah,?\s+skip\b/.test(t) ||
    /\bgo\s+ahead\s+and\s+skip\b/.test(t) ||
    /\bskip\s+please\b/.test(t)
  );
}

/**
 * User asks to skip the active scenario beat without going through frustration-meta classification
 * (e.g. exempt resume/name prompts wipe `effective` meta — client still routes explicit skip phrases).
 */
export function looksLikeProactiveScenarioSkipRequest(text: string): boolean {
  return looksLikeFrustrationSkipAcceptance(text);
}

/** Affirmative reply after the assistant asked whether to skip (yes / skip / let's skip, etc.). */
export function looksLikeFrustrationSkipConfirmationAffirmative(text: string): boolean {
  if (looksLikeFrustrationSkipAcceptance(text)) return true;
  const raw = text.trim();
  if (!raw || raw.length > 120) return false;
  const t = raw.toLowerCase();
  if (/\b(don'?t|do not)\s+(want\s+to\s+)?skip\b/.test(t)) return false;
  return (
    /^(yes|yeah|yep|yup|sure|ok|okay|please)\.?$/i.test(raw) ||
    /^(do\s+it|go\s+ahead)\.?$/i.test(raw) ||
    /^yes[,.]?\s+(please\s+)?skip\b/i.test(t)
  );
}

/** Negative reply when we're waiting for skip confirmation — stay on the question. */
export function looksLikeSkipConfirmationDecline(text: string): boolean {
  const raw = text.trim();
  if (!raw || raw.length > 200) return false;
  if (looksLikeFrustrationSkipConfirmationAffirmative(raw)) return false;
  const t = raw.toLowerCase();
  if (/^(no|nope|nah)\.?$/i.test(raw)) return true;
  if (/^no[,.]?\s*(thanks|thank you)\.?$/i.test(t)) return true;
  if (/\b(don'?t|do not)\s+(want\s+to\s+)?skip\b/.test(t)) return true;
  if (/^no\s*(,\s*)?skip\s*$/i.test(raw) && !/\blet'?s\b/i.test(t)) return true;
  if (/\blet'?s\s+not\s+skip\b/.test(t)) return true;
  if (/\b(let'?s\s+)?stay\s+(on|with)\s+(this|it|that)\b/.test(t)) return true;
  if (/\bkeep\s+(going|trying)\b/.test(t)) return true;
  if (/^i'?d\s+rather\s+not\b/i.test(t)) return true;
  if (/^i'?ll\s+(answer|try)\b/i.test(t)) return true;
  if (/^no[,.]?\s*(i'?ll|let\s+me|i\s+want\s+to\s+answer)\b/i.test(t)) return true;
  return false;
}

const SKIP_CONFIRM_GREETING_TOKENS = new Set(['hello', 'hi', 'hey', 'hiya', 'yo', 'there']);

/**
 * After the skip-confirmation prompt, a bare greeting checks whether the app is still listening — not a thin answer.
 */
export function looksLikeSkipConfirmationConnectivityGreeting(text: string): boolean {
  const raw = text.trim().replace(/\s+/g, ' ');
  if (!raw || wordCount(raw) > 3) return false;
  const words = raw.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.every((w) => {
    const core = w.replace(/^[^a-z]+|[^a-z]+$/gi, '');
    return SKIP_CONFIRM_GREETING_TOKENS.has(core);
  });
}

/** Client-only line when user sends a connectivity greeting after skip confirmation (no elaboration probe). */
export const SKIP_CONFIRMATION_GREETING_REOPEN_LINE =
  'Still here — just say whatever comes to mind, or we can move on.';

/** Canonical response summary for session_logs (aira_response_delivered). */
export function getMetaCommentCanonicalResponseSummary(
  type: MetaCommentType,
  repeatedFrustration: boolean,
  confusionSubtype?: ConfusionSubtype | null,
  checkingInFrustrationAdjacent?: boolean
): string {
  if (repeatedFrustration) {
    return "No pressure at all — let's just keep going. We can move on whenever you're ready.";
  }
  switch (type) {
    case 'frustration':
      return 'Structured response: reflect prior clause if any → shortened re-ask → ask whether to skip with score warning (or I need to know… path).';
    case 'confusion':
      return confusionSubtype === 'repeat_request'
        ? 'Re-read current interview question in full (verbatim); no reframing, no elaboration/content probe.'
        : 'Simpler reframing of essential ask unless repeat-request subtype; no full vignette paste unless explicit repeat.';
    case 'checking_in':
      return checkingInFrustrationAdjacent === true
        ? 'Ownership + salient reflection + pivot forward (no same-question re-ask).'
        : "Yes — got it. That works perfectly.";
    case 'skip_request':
      return 'Are you sure you want to skip this one? We can, but it may affect your score.';
    case 'inability':
      return 'Low-pressure invitation to share whatever comes to mind; same question beat; no skip counted.';
    case 'already_answered':
      return 'Verify transcript — ownership + advance if prior substantive; otherwise frustration-style re-ask with skip offer.';
    case 'ambiguous_short':
      return 'Take your time — just say whatever comes to mind.';
  }
}

/**
 * Injected after core interviewer instructions when a meta-comment is detected so the model does not
 * fire an elongating probe and responds per category.
 */
export function buildMetaCommentHandlingSuffix(args: {
  classification: MetaCommentClassification;
  repeatedFrustrationInMoment: boolean;
  /** First frustration signal only — whether a prior user turn in this scenario had substantive content (client-computed). */
  hadPriorSubstantiveAnswerInMoment?: boolean;
  /**
   * Sufficiency challenges ("Wasn't that enough?") — skip reflective quote even when prior substantive
   * answers exist; reflection reads as repeating them.
   */
  omitPriorReflectionClause?: boolean;
  /**
   * `already_answered` only — client verified a ≥8 word non-meta prior user turn in this interview moment.
   */
  alreadyAnsweredPriorSubstantiveVerified?: boolean;
  /** `checking_in` only — likely frustration-adjacent signal from prior turn + current phrasing. */
  checkingInFrustrationAdjacent?: boolean;
  /** `checking_in` only — already inside Moment 5 after accountability probe fired. */
  inMoment5AfterAccountabilityProbe?: boolean;
}): string {
  const {
    classification,
    repeatedFrustrationInMoment,
    hadPriorSubstantiveAnswerInMoment,
    omitPriorReflectionClause,
    alreadyAnsweredPriorSubstantiveVerified,
    checkingInFrustrationAdjacent,
    inMoment5AfterAccountabilityProbe,
  } = args;
  const t = classification.type;

  if (t === 'skip_request') {
    return `
─────────────────────────────────────────
META-COMMENT (CLIENT): SKIP REQUEST — NEXT / ADVANCE ASK
─────────────────────────────────────────
The participant asked to move on or for the next question (meta only — **not** a substantive answer).

**App pipeline:** The client speaks the confirmation line **verbatim** this turn and does **not** use model output for this classification. **Do not** assume this suffix applies to your reply — no assistant generation for this path in the interview app.
`;
  }

  if (t === 'inability') {
    return `
─────────────────────────────────────────
META-COMMENT: INABILITY (CANNOT ANSWER)
─────────────────────────────────────────
They are signaling genuine inability to produce content — **not** refusal and **not** a request to skip.

**elongating_probe override:** Do **not** deliver any elongating probe this turn.

**First signal (or personal moments handled by model):** Do **not** re-read the vignette, do **not** repeat the full question verbatim, and do **not** push for more detail. Offer **one** low-pressure invitation only, same beat — examples:
• "No pressure — just say whatever comes to mind, even if it's just a few words."
• "There's no right answer here — just whatever feels true to you."

If the client already delivered this invitation client-side, your reply must **not** contradict it — continue the scripted sequence only when the user provides a substantive answer on a **later** turn.

**Second signal in the same moment (client):** Routes to the standard skip-confirmation line — you may not see model traffic for that confirmation on mobile.

Never consume a skip or threaten score impact on the **first** inability signal.
`;
  }

  if (t === 'already_answered') {
    const noElongatingIn = `
**elongating_probe override:** Do **not** deliver any elongating probe this turn (META-COMMENT classification active).

`;
    if (alreadyAnsweredPriorSubstantiveVerified === true) {
      return `
─────────────────────────────────────────
META-COMMENT: ALREADY ANSWERED — PRIOR SUBSTANCE VERIFIED (CLIENT)
─────────────────────────────────────────
${noElongatingIn}
The participant believes they already answered. The client verified a **prior substantive user turn** in this moment (≥8 words, not classified as a meta-comment).

**Take ownership** — they were not wrong. Extract **one short reflective clause** using **only** words they already said on that prior turn (same extraction discipline as frustration reflection). **Never** invent content.

Then **advance** to the **next scripted question** in normal sequence. **No** skip offer and **no** score warning.

Structure examples (spoken as one turn):
• "You're right — [reflection]. Let's keep going. [next question]."
• "My mistake — you mentioned [reflection]. Moving on. [next question]."
• "Got it, you're right — [reflection]. [next question]."

If nothing concrete is extractable from their prior words: "You're right — my mistake. [next question]."
`;
    }
    return `
─────────────────────────────────────────
META-COMMENT: ALREADY ANSWERED — NO PRIOR SUBSTANCE IN THIS MOMENT (CLIENT)
─────────────────────────────────────────
${noElongatingIn}
The participant used already-answered language, but the client **did not** find a qualifying prior substantive answer in this moment.

**Do not** apologize as if you erred. Single spoken turn — neutral, non-punitive:

"Sounds like you've said what you wanted to say. [shortened essential re-ask — same discipline as frustration]. Or we can skip it, but it may affect your score."

Mirror the frustration skip rule: **ask** whether they want to skip — do **not** skip automatically.
`;
  }

  if (repeatedFrustrationInMoment && t === 'frustration') {
    return `
─────────────────────────────────────────
META-COMMENT (CLIENT): REPEATED FRUSTRATION — SAME MOMENT
─────────────────────────────────────────
The participant has shown frustration more than once in this interview moment. **Do not** deliver performance praise ("you're doing great," etc.). **Do not** fire an elongating probe or ask them to elaborate further on this beat.

**Your entire assistant message this turn must be only** (verbatim, then stop — user will continue via mic when ready):
"No pressure at all — let's just keep going. We can move on whenever you're ready."

Then continue the scripted sequence on a **later** turn — do not probe this same question further.
`;
  }

  const noElongating = `
**elongating_probe override:** Do **not** deliver any elongating probe this turn (META-COMMENT classification active).

`;

  if (t === 'frustration') {
    const usePriorReflection =
      hadPriorSubstantiveAnswerInMoment === true && omitPriorReflectionClause !== true;
    const sufficiencyPushbackNote =
      omitPriorReflectionClause === true
        ? `
**Sufficiency pushback (client):** They are challenging whether more was needed — **do not** open by quoting or reflecting what they already said on prior turns; that reads as repeating them. Still deliver essential re-ask + skip confirmation question below (same structure as no-reflection branch).
`
        : '';
    const priorBranch = usePriorReflection
      ? `
**Prior substantive answer detected (client):** Start with **one short reflective clause** taken **only** from words the participant already said earlier **in this scenario** on a prior turn — quote or tightly paraphrase one concrete point they offered. **Do not** invent feelings or summarize if there is nothing extractable (client falls back to the no-prior branch when unclear).
Structure (single spoken turn, same TTS):
  [reflection clause]. I need to know [essential re-ask — shortened]. We can skip this question but it may affect your score, do you still want to skip it?
Example (tone only): "You touched on the emotional disconnect. I need to know how James would repair this. We can skip this question but it may affect your score, do you still want to skip it?"
`
      : `
**No prior substantive answer — or reflection suppressed (client):** Do **not** reflect or quote prior turns. Use:
Structure (single spoken turn):
  I need to know [essential re-ask — shortened]. We can skip this question but it may affect your score, do you still want to skip it?
Example (tone only): "I need to know how James would repair this. We can skip this question but it may affect your score, do you still want to skip it?"
`;
    return `
─────────────────────────────────────────
META-COMMENT (CLIENT): FRUSTRATION — FIRST SIGNAL (same moment)
─────────────────────────────────────────
${noElongating}
The participant is pushing back or frustrated about the **active question**. **Do not** say "you're doing great" or other evaluative performance praise.

**Stay-in-place guard (this turn):** Do **not** close or wrap up the scenario ("that's the end of this scenario," "nice work" as a scenario closer, etc.), do **not** introduce the next vignette, and do **not** jump to the **next** scripted scenario or moment. Stay on this **same** interview moment until they answer substantively or **confirm** they want to skip on a **later** user turn (you will then receive **SKIP ACCEPTED**).

**Re-asking:** Strip vignette setup and scene-setting from the original prompt. Ask **only** the essential interrogative core — shorter and lighter than before — **never** repeat the full prior question verbatim.

**Skip confirmation (not an immediate skip):** Always end by **asking** whether they want to skip, using this wording (or equivalent): "We can skip this question but it may affect your score, do you still want to skip it?" One confirmation prompt only for this moment — **do not** ask again on later turns in the same beat unless they bring it up.

If their **next** reply clearly **confirms** they want to skip (yes / skip / let's skip, etc.), the client advances — you will receive a **SKIP ACCEPTED** system note; follow that note's bridge wording, then deliver only the next scripted progression. If they **decline** (no / stay / don't skip), the client handles encouragement — **do not** advance the scenario on that turn.

**checking_in** signals ("Was that enough?", etc.) stay on their **own** path — never mix this frustration structure with checking_in.
${sufficiencyPushbackNote}
${priorBranch}
`;
  }

  if (t === 'confusion' && classification.confusion_subtype === 'repeat_request') {
    return `
─────────────────────────────────────────
META-COMMENT (CLIENT): CONFUSION — REPEAT REQUEST (heard / misheard the question)
─────────────────────────────────────────
${noElongating}
The participant asked to **hear the interview question again** (repeat / didn't catch / what did you ask) — **not** a request for reframing, examples, or more detail.

**Delivery rule:** Re-read the **current active scripted question in full** — the same wording the participant was answering before this meta turn (verbatim is ideal; fix only tiny clarity glitches). **Do not** replace it with a paraphrase, a simplification, a different angle, or a vignette excerpt unless the scripted prompt itself is the vignette setup.

**Forbidden this turn:** "Can you say more about that?", any elongating probe, asking them to elaborate, or answering on their behalf.

After you finish reading the question, **stop** and wait for their mic reply.
`;
  }

  if (t === 'confusion') {
    return `
─────────────────────────────────────────
META-COMMENT (CLIENT): CONFUSION ABOUT THE QUESTION
─────────────────────────────────────────
${noElongating}
They are asking for clarification about what you're asking — **not** a verbatim repeat request (see REPEAT REQUEST subtype when they asked to hear the question again).

**Do not** repeat the last question verbatim unless they explicitly asked to hear it again. Reframe in **simpler, concrete** terms.

**Never** re-read the scenario vignette or paste the situation block unless the user **explicitly** asked to hear it again. You may offer **one short** restatement of what you're asking — not the full vignette.

Example tone:
"Just tell me what you think is happening between the two of them. If you want, I can repeat the question in one sentence — otherwise go with your read."

Then wait for their next reply on the mic. No elongating probe.
`;
  }

  if (t === 'checking_in') {
    if (checkingInFrustrationAdjacent === true) {
      const moment5PivotNote =
        inMoment5AfterAccountabilityProbe === true
          ? `
**Moment 5 special rule (client state):** Accountability probe already fired. Do **not** re-ask "What was your part in how it unfolded?" again. Pivot to a repair-oriented next probe/question instead (what helped repair, what changed, what they did next).
`
          : '';
      return `
─────────────────────────────────────────
META-COMMENT (CLIENT): CHECKING-IN + FRUSTRATION ADJACENT
─────────────────────────────────────────
${noElongating}
The participant appears to be checking whether they were heard **with frustration undertone** after a substantive response.

Your single next message must:
1) Take ownership briefly ("Yes — I heard you." / "I got you, my mistake."),
2) Reflect one salient point from what they just said (short clause, no invention),
3) Pivot to the next contextually relevant probe/question.

Hard rule: **Do not re-ask the same question** that preceded this checking-in turn.
${moment5PivotNote}
For scenario turns, advance to the next question in sequence rather than re-probing the same construct.
`;
    }
    return `
─────────────────────────────────────────
META-COMMENT (CLIENT): CHECKING IF THEY WERE HEARD
─────────────────────────────────────────
${noElongating}
They want confirmation their answer registered — treat this as **answer acceptance**. Their substantive reply (if any) in this turn **satisfies** the active question unless they clearly gave **no** content at all.

**No reflection clause** of their prior answer here unless needed for register — **no** skip offer. Your single assistant message this turn must include **two parts in order**, same paragraph / same spoken turn:
1) **One short confirmation** (e.g. "Yes — got it." / "Got it.") — **no** evaluative "great."
2) **Immediately after**, one bridging phrase then the **next scripted question** (same spirit as): "Got it — let's keep going. [next question]."

**Never** use the frustration path (reflection + skip confirmation) for checking_in.
`;
  }

  // ambiguous_short
  return `
─────────────────────────────────────────
META-COMMENT (CLIENT): AMBIGUOUS / VERY SHORT
─────────────────────────────────────────
${noElongating}
Their message was very short and not clearly an answer. **No** evaluative praise.

**Never** re-read the scenario vignette, never paste the fictional setup again, and never repeat the active question verbatim unless the user **explicitly** requested a repeat.

Use this neutral invitation (or equivalent): "Just say whatever comes to mind."

Then wait for their next recording on the **same** beat — no elongating probe line from the approved list.
`;
}

function stripNameTokenPunctuationForValidation(token: string): string {
  return token.replace(/[.!?,;:]+$/g, '').trim();
}

/** Mirrors Aria greeting-name heuristic — short name-like reply on first user turn. */
export function looksLikeShortNameReply(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 50) return false;
  const parts = t
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => stripNameTokenPunctuationForValidation(p))
    .filter((p) => p.length > 0);
  return parts.length <= 2 && parts.every((p) => /^[a-zA-Z'-]+$/.test(p));
}

/** Telemetry on why classification was nulled for meta-comment routing */
export type ExemptMetaCommentTurnReason =
  | 'name_entry_turn'
  | 'post_meta_ack_window_active'
  | 'seq_not_advanced_since_last_ack'
  | 'no_exemption_condition_met';

export type ResolvedMetaComment = {
  raw: MetaCommentClassification | null;
  effective: MetaCommentClassification | null;
  exemptMetaCommentTurn: boolean;
  exemptMetaCommentTurnReason: ExemptMetaCommentTurnReason;
};

/**
 * First classification after transcription: raw classifier + narrow interview exemptions.
 * Exempt only (a) first-turn greeting-name reply, or (b) short replies (fewer than 8 words) still inside the
 * post–meta-ack window before the next substantive question delivery.
 */
export function resolveMetaCommentForInterviewTurn(
  text: string,
  ctx: {
    lastQuestionText: string | null | undefined;
    priorUserUtteranceCount: number;
    isInterviewAppRoute: boolean;
    hasProfileFirstName: boolean;
    /**
     * True only while still between a meta-comment acknowledgment that did not yet pair with a substantive
     * interview delivery (see `countsAsSubstantiveInterviewQuestionDelivery`) — suppress duplicate meta reads.
     */
    suppressMetaClassificationPostMetaAckAwaitingSubstantive?: boolean;
    /** Prefer interview `countSpokenWords` when provided; else heuristic word count on `text`. */
    spokenWordCount?: number;
  }
): ResolvedMetaComment {
  const raw = classifyUserMetaComment(text);
  const wc = ctx.spokenWordCount ?? wordCount(text);
  const isGreetingNameTurn =
    ctx.isInterviewAppRoute &&
    ctx.priorUserUtteranceCount === 0 &&
    !ctx.hasProfileFirstName &&
    looksLikeShortNameReply(text);
  const postMetaAckSeqWindow =
    ctx.suppressMetaClassificationPostMetaAckAwaitingSubstantive === true && wc < 8;

  let exemptMetaCommentTurn = false;
  let exemptMetaCommentTurnReason: ExemptMetaCommentTurnReason = 'no_exemption_condition_met';

  if (isGreetingNameTurn) {
    exemptMetaCommentTurn = true;
    exemptMetaCommentTurnReason = 'name_entry_turn';
  } else if (postMetaAckSeqWindow) {
    exemptMetaCommentTurn = true;
    exemptMetaCommentTurnReason = 'seq_not_advanced_since_last_ack';
  } else {
    exemptMetaCommentTurnReason = 'no_exemption_condition_met';
  }

  const effective = exemptMetaCommentTurn ? null : raw;
  return { raw, effective, exemptMetaCommentTurn, exemptMetaCommentTurnReason };
}

/**
 * Detects checking-in turns that likely include frustration undertone.
 * Intended for routing/telemetry, not primary classification.
 */
export function isCheckingInFrustrationAdjacent(args: {
  checkingInText: string;
  priorSubstantiveText?: string | null | undefined;
}): boolean {
  const current = args.checkingInText.trim().toLowerCase();
  const prior = (args.priorSubstantiveText ?? '').trim().toLowerCase();
  const priorWordCount = wordCount(prior);
  const priorLong = priorWordCount >= 50;
  const priorPersonalOrEmotional =
    /\b(i|my|me|we|our|us)\b/.test(prior) &&
    /\b(feel|felt|hurt|angry|upset|sad|tears?|lonely|argument|fight|stopped talking|cut each other out|self-reflection|passed away|died|grief)\b/.test(
      prior
    );
  const priorDetailedNarrative =
    priorWordCount >= 32 &&
    /\b(there was a time|one time|at one point|i remember when|after|before|that night|for a while)\b/.test(
      prior
    );
  const sharpCheckingIn =
    /\b(did you get all that|was that enough|did that answer it|i already said all of that|i just explained all of that)\b/.test(
      current
    );
  return sharpCheckingIn || priorLong || priorPersonalOrEmotional || priorDetailedNarrative;
}
