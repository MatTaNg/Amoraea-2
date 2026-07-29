import { isApprovedElongatingProbeOnly } from './elongatingProbe';
import { isStandalonePersonalDisclosureAcknowledgment } from './personalDisclosureAckPatterns';
import {
  textContainsScenarioBVignetteBody,
  textContainsScenarioCVignetteBody,
} from './emotionScenarioTransitionInference';
import { normalizeApostrophes, normalizeWhitespace } from './disengagementProbeNormalize';
import {
  CLIENT_MENTALIZING_SURFACE_PROBE,
  CLIENT_REPAIR_REFUSAL_PROBE,
  CLIENT_SHORT_ELABORATION_PROBE,
  SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
} from './interviewDisengagementProbeCopy';
import { isRepairRefusalProbeAssistantLine } from './interviewRepairQuestionDetection';
import {
  isIncompleteScenarioARepairLeadSentence,
  looksLikeScenarioARepairQuestion,
  looksLikeScenarioARepairStreamFragment,
} from './scenarioARepairQuestionHelpers';
import {
  coerceScenarioBJamesDifferentlyQuestionForTts,
  coerceScenarioBJamesRepairQuestionForTts,
  isScenarioBBoundaryReflectionWithoutNextVignette,
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBQ1Question,
  looksLikeScenarioBRepairAsJamesQuestion,
  SCENARIO_B_Q1_CANONICAL,
} from './scenarioBProbeLogic';
import { detectActiveScenarioFromMessage } from './interviewScenarioOpeningStreamGate';
import { resolveSituation3ExactModalPrompt } from './situation3ExactModalPrompt';
import {
  isScenarioABoundaryReflectionWithoutNextVignette,
  looksLikeScenarioAContemptProbeQuestion,
} from './scenarioAContemptProbeTextMatch';
import { isScenarioAQ1Prompt } from './scenarioAContemptProbeCoverage';
import { getScenarioResumeIntroAssistantBody } from './interviewScenarioVignetteCopy';
import {
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
  coerceScenarioCRepairQuestionForTts,
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCRepairAsDanielQuestion,
  looksLikeScenarioCSophiePerspectiveQuestion,
  looksLikeScenarioCSophieReceiveMisparaphraseQuestion,
} from './scenarioCPromptDetection';
import { looksLikeIntroBriefingSpeech } from './interviewPreambleBriefing';
import {
  GO_BACK_REQUEST_DECLINE_LINE,
  INABILITY_INVITATION_ROTATING_LINES,
  SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE,
  SCORE_REQUEST_DECLINE_LINE,
} from './interviewPromptInstructions';
import { isClientAudioRecoveryAssistantLine } from './interviewProceduralMoments';
import { IRRELEVANT_ANSWER_RETRY_LINE } from './interviewAnswerRelevance';
import {
  SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE,
  SKIP_ACCEPTED_SCENARIO_COMPLETE_BRIDGE,
  stripSkipAcceptedNextQuestionBridge,
} from './skipAcceptedNextQuestionBridge';
import {
  FRUSTRATION_SKIP_DECLINE_ENCOURAGEMENT_LINE,
  INABILITY_SKIP_CONFIRMATION_PROMPT_LINE,
  SKIP_CONFIRMATION_GREETING_REOPEN_LINE,
  SKIP_REQUEST_CONFIRMATION_PROMPT_LINE,
} from './metaCommentSkipFrustration';
import { CONFUSION_REPEAT_OFFER_LINE } from './confusionRepeatOfferState';
import { hasScenarioBoundaryWrapPhrase } from './emotionModalTransitionOrchestration';
import { looksLikeBriefStreamAckOnly } from './interviewSpokenTextHeuristics';
import { stripControlTokens } from './interviewControlTokens';
import {
  looksLikeMoment4GrudgePrompt,
  looksLikeMoment4ThresholdQuestion,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY,
  MOMENT_4_GRUDGE_QUESTION_TEXT,
  transcriptIncludesMoment4ThresholdAssistant,
} from './moment4ProbeLogic';
import { looksLikeMoment4SpecificityFollowUpEcho } from './moment4SpecificityFollowUp';
import {
  MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
} from './moment5ProbeLogic';

function transcriptContainsScenarioCRepairQuestion(
  messages: Array<{ role: string; content?: string | null; isWelcomeBack?: boolean; isScoreCard?: boolean }>,
): boolean {
  return messages.some(
    (m) =>
      m.role === 'assistant' &&
      !m.isWelcomeBack &&
      !m.isScoreCard &&
      isScenarioCRepairAssistantPrompt(m.content ?? ''),
  );
}

export function isClientOrElongatingInterviewProbeAssistant(content: string): boolean {
  if (isApprovedElongatingProbeOnly(content)) return true;
  const n = normalizeWhitespace(content);
  return (
    n === normalizeWhitespace(CLIENT_REPAIR_REFUSAL_PROBE) ||
    n === normalizeWhitespace(CLIENT_MENTALIZING_SURFACE_PROBE) ||
    n === normalizeWhitespace(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE) ||
    n === normalizeWhitespace(CLIENT_SHORT_ELABORATION_PROBE)
  );
}

/** Meta-comment / thin follow-up lines — not the substantive scenario question to verbatim-repeat. */
const NON_REPEATABLE_ASSISTANT_LINE_PATTERNS = [
  'can you say more about that',
  'just say whatever comes to mind',
  'say whatever comes to mind',
  'could you say more',
  'can you tell me more',
  "i didn't quite catch that",
  'could you say it again',
  'would you mind repeating that',
  'seems like an interruption happened',
  "sorry, i didn't catch",
  'can you elaborate',
  'go on',
  'tell me more',
  'what else',
  'take your time',
  'still here',
  "that's a wrap on this one",
  'thanks for going deep',
  "that's the end of this scenario",
  "that's a wrap on this situation",
  // Skip-offer / decline / inability meta — repeat should re-ask the scenario question.
  'stay on this one',
  "you've got this",
  'just try your best',
  'want to skip',
  'do you still want to skip',
  'are you sure you want to skip',
  'may affect your score',
  'no right answer here',
  'no pressure',
  "can't reveal scores",
  'cannot reveal scores',
  "can't go back",
  'cannot go back',
  // Audio / silent-buffer / mic recovery — never re-speak as the interview question.
  "didn't catch any speech",
  'on that try',
  'tap the mic when',
  'only caught part of that',
  "couldn't hear anything",
  'couldnt hear anything',
  "couldn't hear you",
  'couldnt hear you',
  'mic did not start',
  'trouble starting the microphone',
] as const;

const NON_REPEATABLE_SKIP_META_EXACT_LINES = [
  FRUSTRATION_SKIP_DECLINE_ENCOURAGEMENT_LINE,
  SKIP_REQUEST_CONFIRMATION_PROMPT_LINE,
  INABILITY_SKIP_CONFIRMATION_PROMPT_LINE,
  SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE,
  SKIP_CONFIRMATION_GREETING_REOPEN_LINE,
  SCORE_REQUEST_DECLINE_LINE,
  GO_BACK_REQUEST_DECLINE_LINE,
  CONFUSION_REPEAT_OFFER_LINE,
  IRRELEVANT_ANSWER_RETRY_LINE,
  SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE,
  SKIP_ACCEPTED_SCENARIO_COMPLETE_BRIDGE,
  ...INABILITY_INVITATION_ROTATING_LINES,
].map((line) => normalizeWhitespace(line).toLowerCase());

/**
 * Short scenario-transition bridge without a question (e.g. "Got it — moving on. Here's the next
 * situation.") — repeat must re-ask the scenario prompt, not replay the bridge.
 */
export function looksLikeScenarioTransitionBridgeAssistantLine(content: string): boolean {
  const t = normalizeWhitespace(content ?? '').trim();
  if (!t || t.length > 160) return false;
  if (/\?/.test(t)) return false;
  return /\b(here'?s the next (situation|one)|moving on|on to the next (situation|one)|let'?s (move|go) (on )?to the next|next situation)\b/i.test(
    t,
  );
}

/** Boundary / pivot lines without a question — not the main prompt to replay on resume. */
export function looksLikeNonQuestionScenarioTransitionLine(content: string): boolean {
  const t = normalizeWhitespace(content ?? '').trim();
  if (!t || /\?/.test(t)) return false;
  if (looksLikeBriefStreamAckOnly(t)) return true;
  if (looksLikeScenarioTransitionBridgeAssistantLine(t)) return true;
  if (hasScenarioBoundaryWrapPhrase(t)) return true;
  if (
    /^got it[.!—–-]?\s/i.test(t) &&
    /\b(one more|get personal|next situation|second one done|moving on|third situation)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

/** Main interview prompts to replay — substantive questions, not boundary pivots or brief acks. */
export function isRepeatableMainInterviewQuestionLine(content: string): boolean {
  const raw = normalizeWhitespace(content ?? '').trim();
  if (!raw) return false;
  if (looksLikeNonQuestionScenarioTransitionLine(raw)) return false;
  if (isNonRepeatableAssistantLineForVerbatimReplay(raw)) return false;
  if (/\?/.test(raw)) return true;
  if (looksLikeScenarioARepairQuestion(raw)) return true;
  if (looksLikeScenarioAContemptProbeQuestion(raw)) return true;
  if (looksLikeScenarioBRepairAsJamesQuestion(raw)) return true;
  if (looksLikeScenarioBJamesDifferentlyQuestion(raw)) return true;
  if (isScenarioCRepairAssistantPrompt(raw)) return true;
  if (looksLikeScenarioCSophiePerspectiveQuestion(raw)) return true;
  if (looksLikeMoment4GrudgePrompt(raw)) return true;
  if (looksLikeMoment4ThresholdQuestion(raw)) return true;
  return false;
}

export function isNonRepeatableAssistantLineForVerbatimReplay(content: string): boolean {
  if (isStandalonePersonalDisclosureAcknowledgment(content)) return true;
  // Sophie / construct probes are the current question — allow verbatim repeat.
  if (looksLikeScenarioCSophiePerspectiveQuestion(content)) return false;
  if (isClientAudioRecoveryAssistantLine(content)) return true;
  if (looksLikeNonQuestionScenarioTransitionLine(content)) return true;
  if (looksLikeScenarioTransitionBridgeAssistantLine(content)) return true;
  // Bridge-only skip-accept line (no trailing question) — never verbatim-repeat.
  const afterSkipBridge = stripSkipAcceptedNextQuestionBridge(content);
  if (
    afterSkipBridge !== normalizeWhitespace(content ?? '').trim() &&
    !afterSkipBridge
  ) {
    return true;
  }
  if (isClientOrElongatingInterviewProbeAssistant(content)) return true;
  if (looksLikeScenarioCSophieReceiveMisparaphraseQuestion(content)) return true;
  if (isFullScenarioVignetteIntroAssistantLine(content)) return true;
  if (looksLikeIntroBriefingSpeech(content)) return true;
  const lower = content.trim().toLowerCase();
  if (!lower) return false;
  if (/^welcome back\b/i.test(lower)) return true;
  const normalizedLower = normalizeWhitespace(content).toLowerCase();
  if (NON_REPEATABLE_SKIP_META_EXACT_LINES.some((line) => normalizedLower === line || normalizedLower.includes(line))) {
    return true;
  }
  // Skip confirmation may prefix a short reflection clause before the canonical prompt.
  if (/may affect your score/i.test(lower) && /skip/i.test(lower)) return true;
  return NON_REPEATABLE_ASSISTANT_LINE_PATTERNS.some((pattern) => lower.includes(pattern));
}

/** Long scenario vignette + opening — resume/repeat should replay the latest probe, not the whole intro. */
export function isFullScenarioVignetteIntroAssistantLine(content: string): boolean {
  const raw = (content ?? '').trim();
  if (raw.length < 120) return false;
  if (textContainsScenarioBVignetteBody(raw) || textContainsScenarioCVignetteBody(raw)) return true;
  const lower = raw.toLowerCase();
  return lower.includes('emma and ryan') || lower.includes('ryan takes a call');
}

export function transcriptContainsMentalizingSurfaceProbe(
  messages: Array<{ role: string; content?: string | null }>,
): boolean {
  return messages.some(
    (m) =>
      m.role === 'assistant' &&
      normalizeWhitespace(m.content ?? '') === normalizeWhitespace(CLIENT_MENTALIZING_SURFACE_PROBE),
  );
}

export function transcriptContainsScenarioCSophiePerspectiveProbe(
  messages: Array<{ role: string; content?: string | null }>,
): boolean {
  return messages.some(
    (m) =>
      m.role === 'assistant' &&
      (normalizeWhitespace(m.content ?? '') === normalizeWhitespace(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE) ||
        looksLikeScenarioCSophiePerspectiveQuestion(m.content ?? '')),
  );
}

/**
 * Scenario A only: last assistant line is a repair ask/re-ask, repair-refusal probe, or thin "repeat scenario" offer.
 * **Does not** include word-count elongating probes alone ("Can you say more about that?") — a hard "no" there must
 * still run the scripted Situation 1 follow-ups; client must not auto-advance the scenario.
 * Excludes mentalizing surface probe (hard-stop there must not skip the scenario).
 */
export function scenarioALastAssistantIsRepairProbeOrFollowUp(content: string): boolean {
  const c = content ?? '';
  if (isRepairRefusalProbeAssistantLine(c)) return true;
  if (looksLikeScenarioARepairQuestion(c)) return true;
  const t = normalizeApostrophes(c).toLowerCase();
  if (
    /\b(hear the scenario again|run through it again|anything about the situation that'?s unclear|want me to run through)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\bryan\b/.test(t) && /\b(repair|apolog|fix|make (that |it )?repair|make it happen|work it out|patch things|resolve)\b/.test(t)) {
    return true;
  }
  if (/\b(if you were ryan|you were ryan|as ryan)\b/.test(t) && /\b(how would|how could|what would)\b/.test(t)) {
    return true;
  }
  return false;
}

function userTurnIsRepeatRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /\bcan you repeat\b/i.test(t) ||
    /\brepeat\w* what you said\b/i.test(t) ||
    /\brepeat what you said\b/i.test(t) ||
    /\brepeat the questions?\b/i.test(t) ||
    /\brepeat (the |this |that )?(scenario|situation|story|vignette)\b/i.test(t) ||
    /\bsay (that|it) again\b/i.test(t) ||
    /\bwhat was the question\b/i.test(t) ||
    /\bwhat did you (say|ask)\b/i.test(t) ||
    /\bcome again\b/i.test(t) ||
    /\b(yes|yeah|yep|sure),?\s+repeat\b/i.test(t)
  );
}

/** After truncated S1 boundary wrap, resume replay should open Scenario B — not the broken fragment. */
function resolveScenarioAResumeReplayQuestion(
  messages: Array<{ role: string; content?: string | null }>,
  candidate: string,
): string {
  if (!isScenarioABoundaryReflectionWithoutNextVignette(candidate)) return candidate;
  const hasScenarioBIntro = messages.some(
    (m) => m.role === 'assistant' && textContainsScenarioBVignetteBody(m.content ?? ''),
  );
  if (hasScenarioBIntro) return candidate;
  return getScenarioResumeIntroAssistantBody(2);
}

function inferActiveScenarioForRepeat(
  messages: Array<{ role: string; content?: string | null; scenarioNumber?: number }>,
  explicit?: number | null,
): number | undefined {
  if (typeof explicit === 'number' && explicit >= 1 && explicit <= 3) {
    return explicit;
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const scenarioNumber = messages[i]?.scenarioNumber;
    if (typeof scenarioNumber === 'number' && scenarioNumber >= 1 && scenarioNumber <= 3) {
      return scenarioNumber;
    }
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role !== 'assistant') continue;
    const label = detectActiveScenarioFromMessage((messages[i]?.content ?? '').trim())?.label;
    if (label === 'Situation 3') return 3;
    if (label === 'Situation 2') return 2;
    if (label === 'Situation 1') return 1;
  }
  return undefined;
}

function isScenarioAConstructProbeBleed(raw: string): boolean {
  return (
    looksLikeScenarioARepairQuestion(raw) ||
    looksLikeScenarioAContemptProbeQuestion(raw) ||
    isScenarioAQ1Prompt(raw)
  );
}

/** Prior-scenario assistant lines must not win repeat/resume when a later scenario is active. */
export function isPriorScenarioBleedForActiveScenario(raw: string, activeScenario: number): boolean {
  if (activeScenario === 3) {
    return (
      isScenarioAConstructProbeBleed(raw) ||
      looksLikeScenarioBQ1Question(raw) ||
      isScenarioBBoundaryReflectionWithoutNextVignette(raw) ||
      looksLikeScenarioBRepairAsJamesQuestion(raw) ||
      looksLikeScenarioBJamesDifferentlyQuestion(raw)
    );
  }
  if (activeScenario === 2) {
    return (
      isScenarioAConstructProbeBleed(raw) ||
      looksLikeScenarioCSophiePerspectiveQuestion(raw) ||
      isScenarioCRepairAssistantPrompt(raw) ||
      looksLikeScenarioCRepairAsDanielQuestion(raw)
    );
  }
  if (activeScenario === 1) {
    return (
      looksLikeScenarioBRepairAsJamesQuestion(raw) ||
      looksLikeScenarioBJamesDifferentlyQuestion(raw) ||
      looksLikeScenarioCSophiePerspectiveQuestion(raw) ||
      isScenarioCRepairAssistantPrompt(raw) ||
      looksLikeScenarioCRepairAsDanielQuestion(raw)
    );
  }
  return false;
}

function finalizeRepeatableInterviewQuestionText(
  messages: Array<{ role: string; content?: string | null }>,
  candidate: string,
  activeScenario?: number,
): string {
  let resolved = resolveScenarioCResumeReplayQuestion(
    messages,
    resolveScenarioAResumeReplayQuestion(messages, candidate),
  );
  resolved = coerceScenarioBJamesDifferentlyQuestionForTts(
    coerceScenarioBJamesRepairQuestionForTts(resolved),
  );
  resolved = coerceScenarioCRepairQuestionForTts(resolved);
  if (activeScenario === 3 && isPriorScenarioBleedForActiveScenario(resolved, 3)) {
    return resolveSituation3ExactModalPrompt(messages);
  }
  if (activeScenario === 2 && isPriorScenarioBleedForActiveScenario(resolved, 2)) {
    /**
     * S1 repair bleed stays repair-shaped so {@link resolveInterviewQuestionRepeatTtsText}
     * can remap it to James repair. Contempt/Q1 bleed falls back to Situation 2 Q1.
     */
    if (
      looksLikeScenarioARepairQuestion(resolved) ||
      looksLikeScenarioARepairStreamFragment(resolved) ||
      isIncompleteScenarioARepairLeadSentence(resolved)
    ) {
      return resolved;
    }
    return resolveScenario2RepeatFallbackQuestion(messages);
  }
  return resolved;
}

function resolveScenario2RepeatFallbackQuestion(
  messages: Array<{ role: string; content?: string | null }>,
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const raw = (m.content ?? '').trim();
    if (!raw) continue;
    if (isNonRepeatableAssistantLineForVerbatimReplay(raw)) continue;
    if (isPriorScenarioBleedForActiveScenario(raw, 2)) continue;
    if (
      looksLikeScenarioBQ1Question(raw) ||
      looksLikeScenarioBJamesDifferentlyQuestion(raw) ||
      looksLikeScenarioBRepairAsJamesQuestion(raw)
    ) {
      return coerceScenarioBJamesDifferentlyQuestionForTts(
        coerceScenarioBJamesRepairQuestionForTts(raw),
      );
    }
  }
  return SCENARIO_B_Q1_CANONICAL;
}

function resolveScenario3RepeatFallbackQuestion(
  messages: Array<{ role: string; content?: string | null }>,
): string {
  return resolveSituation3ExactModalPrompt(messages);
}

function transcriptHasPersonalPartProgress(
  messages: ReadonlyArray<{
    role: string;
    content?: string | null;
    interviewMoment?: number;
    isWelcomeBack?: boolean;
    isScoreCard?: boolean;
  }>,
): boolean {
  if (messages.some((m) => typeof m.interviewMoment === 'number' && m.interviewMoment >= 4)) {
    return true;
  }
  return messages.some(
    (m) =>
      m.role === 'assistant' &&
      !m.isWelcomeBack &&
      !m.isScoreCard &&
      (looksLikeMoment4GrudgePrompt(m.content ?? '') ||
        looksLikeMoment4ThresholdQuestion(m.content ?? '') ||
        looksLikeMoment4SpecificityFollowUpEcho(m.content ?? '')),
  );
}

/** Last Moment 4 personal question to replay on resume/repeat — grudge, threshold, or specificity follow-up. */
export function findLastMoment4RepeatableQuestionText(
  messages: Array<{
    role: string;
    content?: string | null;
    interviewMoment?: number;
    isWelcomeBack?: boolean;
    isScoreCard?: boolean;
  }>,
): string | null {
  if (!transcriptHasPersonalPartProgress(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant' || m.isScoreCard || m.isWelcomeBack) continue;
    const raw = stripControlTokens(m.content ?? '').trim();
    if (!raw) continue;
    if (looksLikeMoment4ThresholdQuestion(raw)) {
      return MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY;
    }
    if (looksLikeMoment4SpecificityFollowUpEcho(raw)) {
      return raw.includes('?') ? raw : `${raw}?`;
    }
    if (looksLikeMoment4GrudgePrompt(raw)) {
      return MOMENT_4_GRUDGE_QUESTION_TEXT;
    }
  }
  if (messages.some((m) => typeof m.interviewMoment === 'number' && m.interviewMoment >= 4)) {
    if (transcriptIncludesMoment4ThresholdAssistant(messages)) {
      return MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY;
    }
    return MOMENT_4_GRUDGE_QUESTION_TEXT;
  }
  return null;
}

/** Last real scenario/interview question to re-read on repeat-request — skips client elongating probes. */
export function findLastRepeatableInterviewQuestionText(
  messages: Array<{
    role: string;
    content?: string | null;
    isScoreCard?: boolean;
    isWelcomeBack?: boolean;
    scenarioNumber?: number;
  }>,
  fallbackLastQuestionText?: string | null,
  options?: { activeScenario?: number | null },
): string {
  const hasMoment5PrimaryQuestion = messages.some(
    (m) =>
      m.role === 'assistant' &&
      !m.isWelcomeBack &&
      !m.isScoreCard &&
      transcriptAssistantContainsMoment5PrimaryConflictQuestion(m.content ?? ''),
  );
  if (!hasMoment5PrimaryQuestion) {
    const moment4Question = findLastMoment4RepeatableQuestionText(messages);
    if (moment4Question) return moment4Question;
  }

  const activeScenario = inferActiveScenarioForRepeat(messages, options?.activeScenario);
  if (hasMoment5PrimaryQuestion) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== 'assistant' || m.isScoreCard || m.isWelcomeBack) continue;
      const raw = stripSkipAcceptedNextQuestionBridge((m.content ?? '').trim());
      if (!raw) continue;
      if (transcriptAssistantContainsMoment5PrimaryConflictQuestion(raw)) {
        return MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT;
      }
    }
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    if (m.isScoreCard) continue;
    if (m.isWelcomeBack) continue;
    const raw = stripSkipAcceptedNextQuestionBridge((m.content ?? '').trim());
    if (!raw) continue;
    if (isNonRepeatableAssistantLineForVerbatimReplay(raw)) continue;
    if (looksLikeNonQuestionScenarioTransitionLine(raw)) continue;
    if (/^i only caught part of that\b/i.test(raw)) continue;
    if (/^welcome back\b/i.test(raw)) continue;
    if (looksLikeScenarioCSophieReceiveMisparaphraseQuestion(raw)) continue;
    if (activeScenario && isPriorScenarioBleedForActiveScenario(raw, activeScenario)) continue;
    return finalizeRepeatableInterviewQuestionText(messages, raw, activeScenario);
  }
  const fb = stripSkipAcceptedNextQuestionBridge((fallbackLastQuestionText ?? '').trim());
  if (
    fb &&
    !isNonRepeatableAssistantLineForVerbatimReplay(fb) &&
    !looksLikeNonQuestionScenarioTransitionLine(fb) &&
    !looksLikeScenarioCSophieReceiveMisparaphraseQuestion(fb)
  ) {
    if (activeScenario && isPriorScenarioBleedForActiveScenario(fb, activeScenario)) {
      if (activeScenario === 3) {
        return resolveScenario3RepeatFallbackQuestion(messages);
      }
      if (activeScenario === 2) {
        return finalizeRepeatableInterviewQuestionText(messages, fb, activeScenario);
      }
    } else {
      return finalizeRepeatableInterviewQuestionText(messages, fb, activeScenario);
    }
  }
  if (activeScenario === 3) {
    return resolveScenario3RepeatFallbackQuestion(messages);
  }
  if (activeScenario === 2) {
    return resolveScenario2RepeatFallbackQuestion(messages);
  }
  return looksLikeScenarioCSophieReceiveMisparaphraseQuestion(fb)
    ? SCENARIO_C_REPAIR_QUESTION_CANONICAL
    : coerceScenarioCRepairQuestionForTts(fb);
}

/** After Sophie impact probe is answered, resume should offer repair Q2 — not replay the wrap or re-ask Sophie. */
function resolveScenarioCResumeReplayQuestion(
  messages: Array<{ role: string; content?: string | null }>,
  candidate: string,
): string {
  if (transcriptContainsScenarioCRepairQuestion(messages)) return candidate;
  let sophieProbeIndex = -1;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const content = m.content ?? '';
    if (
      normalizeWhitespace(content) === normalizeWhitespace(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE) ||
      looksLikeScenarioCSophiePerspectiveQuestion(content)
    ) {
      sophieProbeIndex = i;
    }
  }
  if (sophieProbeIndex < 0) return candidate;
  const userAnsweredAfterSophieProbe = messages
    .slice(sophieProbeIndex + 1)
    .some((m) => m.role === 'user' && (m.content ?? '').trim().length > 0);
  if (!userAnsweredAfterSophieProbe) return candidate;
  if (
    normalizeWhitespace(candidate) === normalizeWhitespace(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE)
  ) {
    return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
  }
  if (isNonRepeatableAssistantLineForVerbatimReplay(candidate)) {
    return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
  }
  return candidate;
}

export { userTurnIsRepeatRequest };
