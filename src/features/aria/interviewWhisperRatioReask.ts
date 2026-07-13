import { countSpokenWords } from '@features/aria/interviewWhisperTranscription';
import {
  isInterviewNameCollectionActive,
  isInterviewPreambleBriefingMoment,
  isNamePromptInterviewMoment,
  isResumeReentryWelcomePrompt,
  isShortAnswerOkForWhisperRatioGate,
  isSimpleYesNoInterviewMoment,
  looksLikeReadinessAffirmation,
  type InterviewNameCollectionContext,
} from '@features/aria/interviewProceduralMoments';

export type WhisperReaskTurnContext =
  | 'name_collection'
  | 'readiness_confirmation'
  | 'substantive';

/** Turn context for Whisper re-ask gating. */
export function getWhisperReaskTurnContext(
  lastQuestionText: string | null | undefined,
  nameCollection?: InterviewNameCollectionContext,
): WhisperReaskTurnContext {
  if (nameCollection && isInterviewNameCollectionActive(nameCollection)) {
    return 'name_collection';
  }
  if (isNamePromptInterviewMoment(lastQuestionText)) return 'name_collection';
  if (
    isSimpleYesNoInterviewMoment(lastQuestionText) ||
    isInterviewPreambleBriefingMoment(lastQuestionText)
  ) {
    return 'readiness_confirmation';
  }
  return 'substantive';
}

export type WhisperReaskEvaluationInput = {
  turnContext: WhisperReaskTurnContext;
  transcriptText: string;
  wordCount: number;
  wordsPerSecond: number;
  shortAnswerOk: boolean;
};

/** Max ratio-style re-asks per assistant question before accepting the transcript and advancing. */
export const WHISPER_RATIO_REASK_MAX_ATTEMPTS_PER_QUESTION = 3;

const MULTIWORD_HARD_STOP_TRANSCRIPTS_NORMALIZED = new Set([
  "i don't know",
  'i dont know',
  "i can't",
  'i cant',
  'i cannot',
  'i do not know',
]);

function normalizeTranscriptForHardStopMatch(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/[.,!?;:…]+$/g, '').trim();
  return s;
}

/** Procedural one-word assent/refusal — not scenario-substance, but complete for ratio gate purposes. */
const SINGLE_WORD_HARD_STOP_NORMALIZED = new Set([
  'no',
  'nope',
  'nah',
  'never',
  'stop',
  'skip',
  'pass',
  'yes',
  'yeah',
  'yep',
  'yup',
  'sure',
  'ok',
  'okay',
  'ready',
]);

/** One-word Whisper tails that usually mean the clip cut off mid-sentence — allow ratio re-ask. */
const SINGLE_WORD_FRAGMENT_NORMALIZED = new Set([
  "that's",
  'thats',
  "it's",
  'its',
  'this',
  'that',
  'so',
  'well',
  'and',
  'but',
  'like',
  'um',
  'uh',
  'er',
]);

/**
 * Single-word successful Whisper turns and short refusal / hard-stop phrases must not trigger the
 * ratio re-ask ("answer again in a full sentence"). Obvious fragments (e.g. "That's") may re-ask.
 */
export function getWhisperRatioReaskSuppressionReason(
  transcriptText: string,
  wordCount: number,
): 'valid_hard_stop' | null {
  const trimmed = transcriptText.trim();
  if (!trimmed || wordCount < 1) return null;
  const n = normalizeTranscriptForHardStopMatch(trimmed);
  if (wordCount === 1) {
    if (SINGLE_WORD_FRAGMENT_NORMALIZED.has(n)) return null;
    if (SINGLE_WORD_HARD_STOP_NORMALIZED.has(n)) return 'valid_hard_stop';
    if (looksLikeReadinessAffirmation(trimmed)) return 'valid_hard_stop';
    return 'valid_hard_stop';
  }
  if (MULTIWORD_HARD_STOP_TRANSCRIPTS_NORMALIZED.has(n)) return 'valid_hard_stop';
  if (looksLikeReadinessAffirmation(trimmed)) return 'valid_hard_stop';
  return null;
}

export type WhisperRatioReaskState = {
  /** True when the client should play the ratio re-ask prompt (subject to per-question attempt cap in AriaScreen). */
  shouldFire: boolean;
  /** Log when non-null: a ratio re-ask would have fired without hard-stop / single-word suppression. */
  logSuppressedReason: 'valid_hard_stop' | null;
};

/**
 * Whisper ratio re-ask: substantive turns with suspicious words/sec or very short answers — unless
 * Whisper already returned a valid single-word answer or a recognized hard-stop phrase.
 */
export function computeWhisperRatioReaskState(input: WhisperReaskEvaluationInput): WhisperRatioReaskState {
  const { turnContext, transcriptText, wordCount, wordsPerSecond, shortAnswerOk } = input;
  const hasNonEmptyTranscript = transcriptText.trim().length > 0;
  if (!hasNonEmptyTranscript) {
    return { shouldFire: true, logSuppressedReason: null };
  }
  if (turnContext === 'name_collection' || turnContext === 'readiness_confirmation') {
    return { shouldFire: false, logSuppressedReason: null };
  }

  const ratioFlag = wordsPerSecond < 0.3 || (!shortAnswerOk && wordCount < 3);
  const wouldFireRatioOnly = ratioFlag && wordCount < 3 && !shortAnswerOk;
  const suppression = getWhisperRatioReaskSuppressionReason(transcriptText, wordCount);
  if (suppression && wouldFireRatioOnly) {
    return { shouldFire: false, logSuppressedReason: 'valid_hard_stop' };
  }
  if (suppression) {
    return { shouldFire: false, logSuppressedReason: null };
  }
  return { shouldFire: wouldFireRatioOnly, logSuppressedReason: null };
}

/**
 * Re-ask trigger for Whisper ratio gate.
 * Exempt contexts (name/readiness): accept any non-empty transcript, regardless of ratio/word-count/confidence.
 */
export function shouldFireWhisperRatioReask(input: WhisperReaskEvaluationInput): boolean {
  return computeWhisperRatioReaskState(input).shouldFire;
}

