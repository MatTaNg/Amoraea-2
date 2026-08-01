import { assistantTextLooksLikeMoment4HandoffLead } from '@features/aria/interviewTransitionBundles';
import { assessablePromptQuestionBody } from '@features/aria/interviewAssessablePromptText';
import { extractScenarioModalQuestionFromAssistantText } from '@features/aria/interviewScenarioModalPrompt';
import {
  looksLikeMoment4ThresholdQuestion,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY,
  MOMENT_4_GRUDGE_QUESTION_TEXT,
} from '@features/aria/moment4ProbeLogic';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';
import {
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import {
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCSophiePerspectiveQuestion,
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
} from '@features/aria/scenarioCPromptDetection';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
import { transcriptAssistantContainsMoment5PrimaryConflictQuestion } from '@features/aria/moment5TranscriptHelpers';
import { resolveInterviewQuestionRepeatTtsText } from '@features/aria/scenarioARepairQuestionHelpers';

/**
 * Narrow bundled assistant TTS (handoffs, reflections + pivot + question) to the assessable
 * question line stored in response_timings.question_text.
 */
export function resolveAssessableQuestionTextForResponseTiming(
  raw: string | null | undefined,
): string {
  const t = (raw ?? '').trim();
  if (!t) return '';

  if (transcriptAssistantContainsMoment5PrimaryConflictQuestion(t)) {
    return MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT;
  }
  if (looksLikeMoment4ThresholdQuestion(t)) {
    return MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY;
  }
  if (
    assistantTextLooksLikeMoment4HandoffLead(t) &&
    /\b(?:held a grudge|really hard time with|got under your skin)\b/i.test(t)
  ) {
    return MOMENT_4_GRUDGE_QUESTION_TEXT;
  }
  if (looksLikeScenarioCSophiePerspectiveQuestion(t)) {
    return SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
  }
  if (isScenarioCRepairAssistantPrompt(t)) {
    return SCENARIO_C_REPAIR_QUESTION_CANONICAL;
  }
  if (looksLikeScenarioBRepairAsJamesQuestion(t)) {
    return SCENARIO_B_JAMES_REPAIR_CANONICAL;
  }

  const extracted = extractScenarioModalQuestionFromAssistantText(t);
  if (extracted?.trim()) {
    return extracted.trim();
  }

  return assessablePromptQuestionBody(t) || t;
}

/** Resume welcome / replay: strip scenario-close pivots and keep the pending question only. */
export function resolveQuestionOnlyTextForResumeWelcome(
  raw: string | null | undefined,
  options?: {
    firstName?: string;
    lastUserAnswer?: string | null;
    activeScenario?: number;
  },
): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return '';
  const assessable = resolveAssessableQuestionTextForResponseTiming(trimmed);
  const seed = (assessable || trimmed).trim();
  return resolveInterviewQuestionRepeatTtsText(seed, options).trim();
}
