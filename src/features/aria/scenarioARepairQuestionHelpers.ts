import { textContainsScenarioBVignetteBody } from './emotionScenarioTransitionInference';
import { normalizeApostrophes } from './disengagementProbeNormalize';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from './probeAndScoringUtils';
import {
  transcriptContainsScenarioAContemptProbe,
  transcriptHasUserResponseAfterScenarioAContemptProbe,
  userIsAnsweringAfterStreamDeliveredScenarioAContemptProbe,
  type ScenarioFollowUpTranscriptMessage,
} from './scenarioFollowUpTranscriptGuard';
import { coerceScenarioCBoundaryHandoffForTts, SCENARIO_C_REPAIR_QUESTION_CANONICAL } from './scenarioCPromptDetection';
import { coerceMoment4ThresholdQuestionForTts } from './moment4ProbeLogic';
import { coerceScenarioCRepairQuestionForTts } from './scenarioCPromptDetection';
import { coerceIncompleteInterviewClosingForTts } from './elongatingProbe';
import {
  coerceScenarioBJamesRepairQuestionForTts,
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from './scenarioBProbeLogic';

/** Scenario A repair-as-Ryan (canonical + paraphrases aligned with interviewerFrameworkPrompt). */
export function looksLikeScenarioARepairQuestion(text: string): boolean {
  const t = normalizeApostrophes(text).toLowerCase();
  const hasRyanPerspective = /\b(what if you were ryan|so if you were ryan|and if you were ryan|if you were ryan|you were ryan|as ryan)\b/.test(
    t,
  );
  const hasRepairVerb = /\brepair(?:ing|ed)?\b/.test(t) || /\bgo about repair(?:ing|ed)?\b/.test(t);
  const ryanRepair =
    hasRyanPerspective &&
    hasRepairVerb &&
    (/\b(situation|relationship|this|off)\b/.test(t) || t.length < 120);
  return (
    t.includes('how would you repair this relationship if you were ryan') ||
    t.includes('how would you repair this as ryan') ||
    t.includes('if you were ryan, how would you repair') ||
    (t.includes('if you were ryan') && t.includes('repair this relationship')) ||
    (hasRyanPerspective && /\bhow would you go about repair(?:ing|ed)?\b/.test(t)) ||
    ryanRepair
  );
}

/** TTS + Show scenario modal copy for the Ryan repair ask (matches {@link SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY}). */
export function coerceScenarioARepairQuestionForTts(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return text;
  // Preserve the second repair re-ask — coercing to the canonical first ask triggers duplicate_consecutive TTS suppression.
  if (looksLikeScenarioARepairReAskQuestion(t)) {
    return text;
  }
  if (
    looksLikeScenarioARepairQuestion(t) ||
    isIncompleteScenarioARepairLeadSentence(t) ||
    isTruncatedScenarioRepairQuestion(t) ||
    looksLikeScenarioARepairStreamFragment(t)
  ) {
    return SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
  }
  const low = normalizeApostrophes(t).toLowerCase();
  if (/\b(as ryan|if you were ryan)\b/.test(low) && /\brepair\b/.test(low)) {
    return SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
  }
  if (/\bhow would you repair this with\b/.test(low) && /\bryan\b/.test(low)) {
    return SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
  }
  return text;
}

/** S1→S2 boundary reflections often include "makes sense" + Emma — not repair asks. */
export function shouldSkipScenarioARepairDraftNormalization(draft: string): boolean {
  const t = (draft ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return true;
  const low = normalizeApostrophes(t).toLowerCase();
  if (textContainsScenarioBVignetteBody(t)) return true;
  if (/\b(next situation|here'?s the next|third situation|two more situations)\b/.test(low)) {
    return true;
  }
  if (/\b(that'?s a wrap|wrap on (?:that|this) (?:one|situation))\b/.test(low)) {
    return true;
  }
  if (/\b(good work|nice work)\b/.test(low) && /\b(next situation|here'?s the next)\b/.test(low)) {
    return true;
  }
  return false;
}

/** Coerce truncated S1 repair fragments in assistant draft/transcript text before persist. */
export function normalizeScenarioARepairQuestionInAssistantDraft(draft: string): string {
  const t = (draft ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return draft;
  if (shouldSkipScenarioARepairDraftNormalization(t)) return draft;
  if (looksLikeScenarioARepairReAskQuestion(t)) return draft;
  if (
    looksLikeScenarioARepairStreamFragment(t) ||
    looksLikeScenarioARepairQuestion(t) ||
    isIncompleteScenarioARepairLeadSentence(t) ||
    isTruncatedScenarioRepairQuestion(t)
  ) {
    return coerceScenarioARepairQuestionForTts(t);
  }
  if (/\bthis with emma\?/i.test(t) || /\brepair this with emma\b/i.test(t)) {
    return coerceScenarioARepairQuestionForTts(t);
  }
  return draft;
}

/** Scenario A second repair ask after the canonical Ryan repair question (model paraphrase). */
export function looksLikeScenarioARepairReAskQuestion(text: string): boolean {
  const t = normalizeApostrophes(text).toLowerCase();
  if (/\bhow would you make that repair actually happen\b/.test(t)) return true;
  if (/\bwhat would that repair look like\b/.test(t) && /\bryan\b/.test(t)) return true;
  if (/\bmake that repair actually happen\b/.test(t) && /\bryan\b/.test(t)) return true;
  if (/\bwhat would you (actually )?do\b/.test(t) && /\bryan\b/.test(t) && /\brepair\b/.test(t)) {
    return true;
  }
  return false;
}

/** Remove a glued Scenario A repair ask from a longer paragraph (model echo / stacked asks). */
export function stripEmbeddedScenarioARepairQuestionAsk(draft: string): string {
  const t0 = (draft ?? '').trim();
  if (!t0) return draft;
  let t = t0;
  const patterns: RegExp[] = [
    /\bHow would you repair this relationship if you were Ryan\??\s*/gi,
    /\bWhat if you were Ryan\??\s*How would you repair this (?:situation|relationship)\??\s*/gi,
    /\bIf you were Ryan[^?.!\n]{0,120}?repair[^?.!\n]{0,120}?[?.!]?\s*/gi,
    /\bHow would you repair this (?:situation|relationship)\??\s*/gi,
  ];
  let prev = '';
  while (prev !== t) {
    prev = t;
    for (const re of patterns) {
      t = t.replace(re, '').replace(/\s{2,}/g, ' ').trim();
    }
  }
  return t
    .replace(/^\s*[.,;—–\-–]\s*/g, '')
    .replace(/\s+[.,;—–\-–]\s*$/g, '')
    .trim();
}

/** After stripping a glued repair ask from a scenario wrap, remove dangling "and" / dash tails. */
export function cleanupScenarioWrapAfterRepairStrip(text: string): string {
  return (text ?? '')
    .replace(/\s+\band\s*$/i, '')
    .replace(/\s+[—–-]\s*$/g, '')
    .trim();
}

/** Strip Scenario A repair-as-Ryan blocks so a forced contempt probe is the only substantive assistant line. */
export function stripScenarioARepairQuestion(text: string): string {
  let cleaned = text
    .replace(/(?:^|\n)\s*How would you repair this relationship if you were Ryan\?\s*/gi, '\n')
    .replace(
      /(?:^|\n)\s*What if you were Ryan\?[^\n]*How would you repair this (?:situation|relationship)\??\s*/gi,
      '\n',
    )
    .replace(/(?:^|\n)\s*If you were Ryan[^?.!\n]*repair[^?.!\n]*[?.!]?\s*/gi, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  cleaned = stripEmbeddedScenarioARepairQuestionAsk(cleaned);
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Streaming TTS often splits on the `?` after "What if you were Ryan?" before the repair tail arrives.
 * Hold the Ryan lead clause until the next flushed sentence can complete the repair ask.
 */
export function isIncompleteScenarioARepairLeadSentence(text: string): boolean {
  const t = normalizeApostrophes(text).trim().toLowerCase();
  if (!t || looksLikeScenarioARepairQuestion(text)) return false;
  const hasRyanLead = /\b(what if you were ryan|so if you were ryan|and if you were ryan|if you were ryan)\b/.test(
    t,
  );
  if (!hasRyanLead) return false;
  if (/\brepair(?:ing|ed)?\b/.test(t) || /\bgo about repair(?:ing|ed)?\b/.test(t)) return false;
  return true;
}

/**
 * Streaming may flush after "repair" but before the ask finishes — no `?`, dangling preposition tail.
 */
export function isTruncatedScenarioRepairQuestion(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || /\?\s*$/.test(t)) return false;
  const low = normalizeApostrophes(t).toLowerCase();
  if (!/\brepair(?:ing|ed)?\b/.test(low)) return false;
  const hasRepairPerspectiveCue =
    (/\bryan\b/.test(low) && /\b(if you were|you were|as ryan)\b/.test(low)) ||
    (/\bjames\b/.test(low) && /\b(if you were|you were|as james)\b/.test(low));
  if (!hasRepairPerspectiveCue) return false;
  if (looksLikeScenarioARepairQuestion(text) || looksLikeScenarioBRepairAsJamesQuestion(text)) {
    return true;
  }
  return /\b(in|and|with|to|for|that|the|a|an|actually|things|now that)\s*$/i.test(t);
}

/** Brief ack glued before a truncated repair ask (Ryan or James). */
export function extractBriefAckBeforeTruncatedRepairProbe(text: string): string | null {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  const m = t.match(
    /^((?:got it|that'?s (?:a )?real read on it|good read|great read|nice work|that makes sense|you(?:'re| are) seeing that|i hear you|makes sense)[^.!?]{0,80})[\.,!]?\s+(?:and\s+)?(?:if you were (?:ryan|james)|how would you)\b/i,
  );
  const ack = m?.[1]?.trim();
  return ack ? ack.replace(/\.$/, '') : null;
}

function isScenarioAConstructProbeContext(
  currentScenario: number | null | undefined,
  currentMoment: number,
): boolean {
  if (currentScenario === 1) return true;
  return currentMoment === 1 && (currentScenario == null || currentScenario <= 1);
}

/** Truncated repair tail from parallel streaming (may omit "Ryan"/"repair" after sentence split). */
export function looksLikeScenarioARepairStreamFragment(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (
    looksLikeScenarioARepairQuestion(t) ||
    isIncompleteScenarioARepairLeadSentence(t) ||
    isTruncatedScenarioRepairQuestion(t)
  ) {
    return true;
  }
  const low = normalizeApostrophes(t).toLowerCase();
  if (
    /\b(things with emma(?:\s+after this)?|repair things with emma|with emma after this)\b/.test(
      low,
    )
  ) {
    return true;
  }
  if (/^(?:now,?\s+)?things with emma\??$/i.test(t)) {
    return true;
  }
  if (/\bmakes sense\b/.test(low) && /\bemma\b/.test(low)) {
    return !shouldSkipScenarioARepairDraftNormalization(t);
  }
  if (/\bthis with emma\b/.test(low) || /\brepair this with emma\b/.test(low)) {
    return true;
  }
  if (/\bhow would you\b/.test(low) && /\bemma\b/.test(low) && /\?\s*$/.test(t)) {
    return true;
  }
  /** Sentence-boundary split after "Got it." — tail may be only "this?" with no Ryan/repair verbs. */
  if (/^this\??$/i.test(low)) {
    return true;
  }
  if (/^(?:got it|okay|ok|makes sense|fair|right|understood|alright)\.\s*this\??$/i.test(low)) {
    return true;
  }
  if (/^how would you (?:go about )?repair(?:ing|ed)? this\??$/i.test(low)) {
    return true;
  }
  if (/\bhow would you\b/.test(low) && /\bryan\b/.test(low) && /\brepair\b/.test(low)) {
    return true;
  }
  if (/\brepair this as ryan\b/.test(low)) {
    return true;
  }
  return false;
}

/** True when parallel-stream or respeak logic already delivered any Scenario A repair ask (canonical or paraphrase). */
export function spokenTextContainsScenarioARepairQuestion(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (looksLikeScenarioARepairStreamFragment(t) || looksLikeScenarioARepairQuestion(t)) {
    return true;
  }
  const segments = t.split(/(?<=[.!?])\s+/);
  if (segments.length <= 1) return false;
  return segments.some((segment) => {
    const s = segment.trim();
    return s.length > 0 && (looksLikeScenarioARepairStreamFragment(s) || looksLikeScenarioARepairQuestion(s));
  });
}

/** Drop parallel-stream batch text that leaked repair copy before the contempt probe is satisfied. */
export function clearParallelTtsBatchIfScenarioARepairLeakBeforeContempt(args: {
  batchText: string;
  suppressRepairBeforeContempt: boolean;
  streamContemptProbeMuteArmedFromStart: boolean;
}): { discarded: boolean; remaining: string } {
  const text = (args.batchText ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return { discarded: false, remaining: '' };
  }
  const shouldDiscard =
    args.streamContemptProbeMuteArmedFromStart ||
    (args.suppressRepairBeforeContempt &&
      (looksLikeScenarioARepairStreamFragment(text) ||
        (/\bmakes sense\b/i.test(text) && /\bemma\b/i.test(text)) ||
        /\b(if you were ryan|how would you repair|how would you go about repair)\b/i.test(text)));
  if (!shouldDiscard) {
    return { discarded: false, remaining: text };
  }
  return { discarded: true, remaining: '' };
}

/** True on the turn after the user answers the Scenario A contempt probe — repair should be spoken. */
export function shouldAllowScenarioARepairAfterContemptAnswer(params: {
  currentScenario: number | null | undefined;
  currentMoment: number;
  scenarioAContemptProbeAsked: boolean;
  scenarioARepairQuestionAsked: boolean;
  replyingToScenarioAQ1: boolean;
  specificEmmaLineAlreadyAddressed: boolean;
  shouldForceScenarioAContemptProbe: boolean;
  messagesToUse: readonly ScenarioFollowUpTranscriptMessage[];
  lastDeliveredQuestionText?: string | null;
}): boolean {
  if (!isScenarioAConstructProbeContext(params.currentScenario, params.currentMoment)) {
    return false;
  }
  const contemptSatisfiedWithoutProbe =
    params.specificEmmaLineAlreadyAddressed &&
    params.scenarioAContemptProbeAsked &&
    !transcriptContainsScenarioAContemptProbe(params.messagesToUse);
  const contemptAnswered =
    transcriptHasUserResponseAfterScenarioAContemptProbe(params.messagesToUse) ||
    contemptSatisfiedWithoutProbe ||
    userIsAnsweringAfterStreamDeliveredScenarioAContemptProbe({
      scenarioAContemptProbeAsked: params.scenarioAContemptProbeAsked,
      scenarioARepairQuestionAsked: params.scenarioARepairQuestionAsked,
      lastDeliveredQuestionText: params.lastDeliveredQuestionText,
      messagesToUse: params.messagesToUse,
    });
  return (
    params.scenarioAContemptProbeAsked &&
    !params.scenarioARepairQuestionAsked &&
    (!params.replyingToScenarioAQ1 || params.specificEmmaLineAlreadyAddressed) &&
    !params.shouldForceScenarioAContemptProbe &&
    contemptAnswered
  );
}

/** Block Ryan repair TTS until contempt is satisfied or the user already covered Emma's line in Q1. */
export function shouldSuppressScenarioARepairBeforeContemptAnswer(params: {
  currentScenario: number | null | undefined;
  currentMoment: number;
  shouldForceScenarioAContemptProbe: boolean;
  scenarioAContemptProbeSpokenThisStream: boolean;
  scenarioAContemptProbeAsked: boolean;
  specificEmmaLineAlreadyAddressed: boolean;
  scenarioARepairQuestionAsked: boolean;
  allowScenarioARepairAfterContemptAnswer?: boolean;
}): boolean {
  if (!isScenarioAConstructProbeContext(params.currentScenario, params.currentMoment)) {
    return false;
  }
  if (params.scenarioARepairQuestionAsked) return false;
  if (params.allowScenarioARepairAfterContemptAnswer) return false;
  if (params.shouldForceScenarioAContemptProbe || params.scenarioAContemptProbeSpokenThisStream) {
    return true;
  }
  if (params.scenarioAContemptProbeAsked && !params.specificEmmaLineAlreadyAddressed) {
    return true;
  }
  return false;
}

/** Scenario B resume/repeat must not replay a Scenario A Ryan repair bleed from a truncated stream chunk. */
function coerceRepeatQuestionForActiveScenario(
  resolvedText: string,
  storedText: string,
  activeScenario?: number,
): string {
  if (activeScenario === 3) {
    if (
      looksLikeScenarioARepairQuestion(resolvedText) ||
      looksLikeScenarioBRepairAsJamesQuestion(resolvedText) ||
      looksLikeScenarioBJamesDifferentlyQuestion(resolvedText)
    ) {
      return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
    }
    return resolvedText;
  }
  if (activeScenario !== 2) return resolvedText;
  const low = normalizeApostrophes(resolvedText).toLowerCase();
  const isScenarioARepairResolved =
    resolvedText === SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY ||
    looksLikeScenarioARepairQuestion(resolvedText) ||
    (/\bryan\b/.test(low) && /\brepair\b/.test(low));
  if (!isScenarioARepairResolved || looksLikeScenarioBRepairAsJamesQuestion(resolvedText)) {
    return resolvedText;
  }
  const ack = extractBriefAckBeforeTruncatedRepairProbe(storedText);
  return ack ? `${ack}. ${SCENARIO_B_JAMES_REPAIR_CANONICAL}` : SCENARIO_B_JAMES_REPAIR_CANONICAL;
}

/** Expand truncated Ryan repair lead-ins and S3→M4 boundary wraps for repeat TTS. */
export function resolveInterviewQuestionRepeatTtsText(
  storedText: string,
  options?: {
    firstName?: string;
    lastUserAnswer?: string | null;
    activeScenario?: number;
  },
): string {
  const t = (storedText ?? '').trim();
  if (!t) return t;
  if (isIncompleteScenarioARepairLeadSentence(t)) {
    return coerceRepeatQuestionForActiveScenario(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
      t,
      options?.activeScenario,
    );
  }
  let resolved = coerceIncompleteInterviewClosingForTts(
    coerceMoment4ThresholdQuestionForTts(
      coerceScenarioCBoundaryHandoffForTts(t, options?.firstName ?? '', options?.lastUserAnswer),
    ),
    options?.firstName ?? '',
  );
  resolved = coerceScenarioARepairQuestionForTts(resolved);
  resolved = coerceScenarioBJamesRepairQuestionForTts(resolved);
  resolved = coerceScenarioCRepairQuestionForTts(resolved);
  return coerceRepeatQuestionForActiveScenario(resolved, t, options?.activeScenario);
}

/**
 * Parallel streaming TTS flushes by sentence before duplicate stripping on the full assistant turn.
 * When the Scenario A repair ask was already spoken, suppress model echoes in a flushed chunk.
 */
export function stripScenarioARepairQuestionStreamingEcho(
  spoken: string,
  repairAlreadyAsked: boolean,
): string | null {
  const t0 = (spoken ?? '').trim();
  if (!repairAlreadyAsked || !t0) {
    return t0;
  }
  if (looksLikeScenarioBRepairAsJamesQuestion(t0)) {
    return t0;
  }
  if (looksLikeScenarioARepairQuestion(t0)) {
    return null;
  }
  const stripped = stripEmbeddedScenarioARepairQuestionAsk(t0).trim();
  if (!stripped) {
    return null;
  }
  if (stripped !== t0) {
    return stripped;
  }
  const low = t0.toLowerCase();
  if (/\b(if you were ryan|what if you were ryan|so if you were ryan)\b/.test(low) && /\brepair(?:ing|ed)?\b/.test(low)) {
    return null;
  }
  if (
    /\bhow would you (?:go about )?repair(?:ing|ed)?\b/.test(low) &&
    /\b(situation|relationship|this|off)\b/.test(low)
  ) {
    return null;
  }
  return t0;
}
