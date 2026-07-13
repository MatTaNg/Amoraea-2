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
  looksLikeScenarioARepairQuestion,
} from './scenarioARepairQuestionHelpers';
import {
  coerceScenarioBJamesDifferentlyQuestionForTts,
  coerceScenarioBJamesRepairQuestionForTts,
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
} from './scenarioBProbeLogic';
import { detectActiveScenarioFromMessage } from './interviewScenarioOpeningStreamGate';
import { resolveSituation3ExactModalPrompt } from './situation3ExactModalPrompt';
import { isScenarioABoundaryReflectionWithoutNextVignette } from './scenarioAContemptProbeTextMatch';
import { getScenarioResumeIntroAssistantBody } from './interviewScenarioVignetteCopy';
import {
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
  coerceScenarioCRepairQuestionForTts,
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCRepairAsDanielQuestion,
  looksLikeScenarioCSophiePerspectiveQuestion,
  looksLikeScenarioCSophieReceiveMisparaphraseQuestion,
} from './scenarioCPromptDetection';

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
] as const;

export function isNonRepeatableAssistantLineForVerbatimReplay(content: string): boolean {
  if (isStandalonePersonalDisclosureAcknowledgment(content)) return true;
  if (isClientOrElongatingInterviewProbeAssistant(content)) return true;
  if (looksLikeScenarioCSophieReceiveMisparaphraseQuestion(content)) return true;
  if (isFullScenarioVignetteIntroAssistantLine(content)) return true;
  const lower = content.trim().toLowerCase();
  if (!lower) return false;
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

/** Prior-scenario assistant lines must not win repeat/resume when a later scenario is active. */
export function isPriorScenarioBleedForActiveScenario(raw: string, activeScenario: number): boolean {
  if (activeScenario === 3) {
    return (
      looksLikeScenarioARepairQuestion(raw) ||
      looksLikeScenarioBRepairAsJamesQuestion(raw) ||
      looksLikeScenarioBJamesDifferentlyQuestion(raw)
    );
  }
  if (activeScenario === 2) {
    return (
      looksLikeScenarioARepairQuestion(raw) ||
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
  return resolved;
}

function resolveScenario3RepeatFallbackQuestion(
  messages: Array<{ role: string; content?: string | null }>,
): string {
  return resolveSituation3ExactModalPrompt(messages);
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
  const activeScenario = inferActiveScenarioForRepeat(messages, options?.activeScenario);
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    if (m.isScoreCard) continue;
    if (m.isWelcomeBack) continue;
    const raw = (m.content ?? '').trim();
    if (!raw) continue;
    if (isNonRepeatableAssistantLineForVerbatimReplay(raw)) continue;
    if (/^i only caught part of that\b/i.test(raw)) continue;
    if (/^welcome back\b/i.test(raw)) continue;
    if (looksLikeScenarioCSophieReceiveMisparaphraseQuestion(raw)) continue;
    if (activeScenario && isPriorScenarioBleedForActiveScenario(raw, activeScenario)) continue;
    return finalizeRepeatableInterviewQuestionText(messages, raw, activeScenario);
  }
  const fb = (fallbackLastQuestionText ?? '').trim();
  if (fb && !isNonRepeatableAssistantLineForVerbatimReplay(fb) && !looksLikeScenarioCSophieReceiveMisparaphraseQuestion(fb)) {
    if (activeScenario && isPriorScenarioBleedForActiveScenario(fb, activeScenario)) {
      if (activeScenario === 3) {
        return resolveScenario3RepeatFallbackQuestion(messages);
      }
    } else {
      return finalizeRepeatableInterviewQuestionText(messages, fb, activeScenario);
    }
  }
  if (activeScenario === 3) {
    return resolveScenario3RepeatFallbackQuestion(messages);
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
