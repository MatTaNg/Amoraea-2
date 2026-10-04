import { assistantTextLooksLikeMoment4HandoffLead } from '@features/aria/interviewTransitionBundles';
import {
  assessablePromptQuestionBody,
  personalScenarioPromptForRepeat,
} from '@features/aria/interviewAssessablePromptText';
import { extractScenarioModalQuestionFromAssistantText } from '@features/aria/interviewScenarioModalPrompt';
import {
  looksLikeMoment4GrudgePrompt,
  looksLikeMoment4OrientationQuestion,
  looksLikeMoment4ThresholdQuestion,
  looksLikeMomentSupportConditionalProbe,
  looksLikeMomentSupportQuestion,
  MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_CARD_BODY,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_CARD_BODY,
  MOMENT_4_GRUDGE_QUESTION_TEXT,
  MOMENT_SUPPORT_CONDITIONAL_PROBE_CARD_BODY,
  MOMENT_SUPPORT_QUESTION_CARD_BODY,
} from '@features/aria/moment4ProbeLogic';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';
import {
  looksLikeScenarioBRepairAsJamesQuestion,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import {
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCSophiePerspectiveQuestion,
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
} from '@features/aria/scenarioCPromptDetection';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from '@features/aria/scenarioAContemptProbeCopy';
import {
  looksLikeScenarioARepairQuestion,
  resolveInterviewQuestionRepeatTtsText,
} from '@features/aria/scenarioARepairQuestionHelpers';
import { transcriptAssistantContainsMoment5PrimaryConflictQuestion } from '@features/aria/moment5TranscriptHelpers';

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
  if (looksLikeMomentSupportConditionalProbe(t)) {
    return MOMENT_SUPPORT_CONDITIONAL_PROBE_CARD_BODY;
  }
  if (looksLikeMomentSupportQuestion(t)) {
    return MOMENT_SUPPORT_QUESTION_CARD_BODY;
  }
  if (looksLikeMoment4OrientationQuestion(t)) {
    return MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_CARD_BODY;
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
  if (looksLikeScenarioARepairQuestion(t)) {
    return SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
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

  const personalPrompt = personalScenarioPromptForRepeat(t);
  if (personalPrompt) return personalPrompt;

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
