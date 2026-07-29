type ScenarioModalTranscriptTurn = { role: string; content?: string | null };

import { isIrrelevantAnswerRetryAssistantLine } from '@features/aria/interviewAnswerRelevance';
import { getLastSubstantiveScenarioModalQuestion } from '@features/aria/interviewScenarioModalPrompt';
import {
  detectActiveScenarioFromMessage,
  normalizeScenarioOpeningForCompare,
  SCENARIO_2_OPENING,
} from '@features/aria/interviewScenarioOpeningStreamGate';
import {
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';

export type Situation2ModalDeliveryState = {
  jamesDifferentlyAsked?: boolean;
  repairQuestionAsked?: boolean;
};

function scopedSituation2AssistantTurnsFromFirstAnchor(
  transcript: ScenarioModalTranscriptTurn[],
): ScenarioModalTranscriptTurn[] {
  let anchorIdx = -1;
  for (let i = 0; i < transcript.length; i++) {
    if (transcript[i]?.role !== 'assistant') continue;
    const detected = detectActiveScenarioFromMessage((transcript[i]?.content ?? '').trim());
    if (detected?.label === 'Situation 2') {
      anchorIdx = i;
      break;
    }
  }
  return anchorIdx >= 0 ? transcript.slice(anchorIdx) : transcript;
}

function transcriptHasJamesDifferentlyProbe(transcript: ScenarioModalTranscriptTurn[]): boolean {
  return scopedSituation2AssistantTurnsFromFirstAnchor(transcript).some(
    (t) =>
      t.role === 'assistant' &&
      looksLikeScenarioBJamesDifferentlyQuestion((t.content ?? '').trim()),
  );
}

function transcriptHasRepairAsJamesProbe(transcript: ScenarioModalTranscriptTurn[]): boolean {
  return scopedSituation2AssistantTurnsFromFirstAnchor(transcript).some(
    (t) =>
      t.role === 'assistant' && looksLikeScenarioBRepairAsJamesQuestion((t.content ?? '').trim()),
  );
}

/** True when Situation 2 modal must not revert to the opening question (vignette replay / Sarah+James reflection). */
export function isSituation2ModalAdvancedPastOpening(
  delivery?: Situation2ModalDeliveryState | null,
  lastQuestionText?: string | null,
  transcript?: ScenarioModalTranscriptTurn[],
): boolean {
  if (delivery?.repairQuestionAsked || delivery?.jamesDifferentlyAsked) return true;
  const last = (lastQuestionText ?? '').trim();
  if (last) {
    if (
      looksLikeScenarioBJamesDifferentlyQuestion(last) ||
      looksLikeScenarioBRepairAsJamesQuestion(last)
    ) {
      return true;
    }
  }
  if (transcript?.length) {
    return transcriptHasRepairAsJamesProbe(transcript) || transcriptHasJamesDifferentlyProbe(transcript);
  }
  return false;
}

/**
 * Situation 2 Show scenario footer — exact scripted copy only (opening → James-differently → repair-as-James).
 */
function resolveSituation2ModalPromptFromSubstantiveQuestion(question: string): string | null {
  const q = question.trim();
  if (!q) return null;
  if (looksLikeScenarioBRepairAsJamesQuestion(q)) {
    return SCENARIO_B_JAMES_REPAIR_CANONICAL;
  }
  if (looksLikeScenarioBJamesDifferentlyQuestion(q)) {
    return SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
  }
  if (normalizeScenarioOpeningForCompare(q) === normalizeScenarioOpeningForCompare(SCENARIO_2_OPENING)) {
    return SCENARIO_2_OPENING;
  }
  return null;
}

export function resolveSituation2ExactModalPrompt(
  transcript: ScenarioModalTranscriptTurn[],
  currentSpoken?: string | null,
  delivery?: Situation2ModalDeliveryState | null,
): string {
  const spoken = (currentSpoken ?? '').trim();
  if (spoken && !isIrrelevantAnswerRetryAssistantLine(spoken)) {
    const fromSpoken = resolveSituation2ModalPromptFromSubstantiveQuestion(spoken);
    if (fromSpoken) return fromSpoken;
  }

  const scoped = scopedSituation2AssistantTurnsFromFirstAnchor(transcript);
  const lastSubstantive = getLastSubstantiveScenarioModalQuestion(scoped);
  if (lastSubstantive) {
    const fromTranscript = resolveSituation2ModalPromptFromSubstantiveQuestion(lastSubstantive);
    if (fromTranscript) return fromTranscript;
  }

  // Resume / delivery-ref fallback when transcript lacks explicit probe lines.
  if (delivery?.repairQuestionAsked && (transcriptHasRepairAsJamesProbe(scoped) || !lastSubstantive)) {
    return SCENARIO_B_JAMES_REPAIR_CANONICAL;
  }
  if (
    delivery?.jamesDifferentlyAsked &&
    (transcriptHasJamesDifferentlyProbe(scoped) || !lastSubstantive)
  ) {
    return SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
  }

  return SCENARIO_2_OPENING;
}
