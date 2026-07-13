type ScenarioModalTranscriptTurn = { role: string; content?: string | null };

import {
  detectActiveScenarioFromMessage,
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

function scopedSituation2AssistantTurns(
  transcript: ScenarioModalTranscriptTurn[],
): ScenarioModalTranscriptTurn[] {
  let anchorIdx = -1;
  for (let i = transcript.length - 1; i >= 0; i--) {
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
  return scopedSituation2AssistantTurns(transcript).some(
    (t) =>
      t.role === 'assistant' &&
      looksLikeScenarioBJamesDifferentlyQuestion((t.content ?? '').trim()),
  );
}

function transcriptHasRepairAsJamesProbe(transcript: ScenarioModalTranscriptTurn[]): boolean {
  return scopedSituation2AssistantTurns(transcript).some(
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
export function resolveSituation2ExactModalPrompt(
  transcript: ScenarioModalTranscriptTurn[],
  currentSpoken?: string | null,
  delivery?: Situation2ModalDeliveryState | null,
): string {
  const spoken = (currentSpoken ?? '').trim();
  if (spoken) {
    if (looksLikeScenarioBRepairAsJamesQuestion(spoken)) {
      return SCENARIO_B_JAMES_REPAIR_CANONICAL;
    }
    if (looksLikeScenarioBJamesDifferentlyQuestion(spoken)) {
      return SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
    }
  }

  if (delivery?.repairQuestionAsked) {
    return SCENARIO_B_JAMES_REPAIR_CANONICAL;
  }
  if (delivery?.jamesDifferentlyAsked) {
    return SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
  }

  const scoped = scopedSituation2AssistantTurns(transcript);
  let lastJamesIdx = -1;
  let lastRepairIdx = -1;
  for (let i = 0; i < scoped.length; i++) {
    if (scoped[i]?.role !== 'assistant') continue;
    const c = (scoped[i]?.content ?? '').trim();
    if (looksLikeScenarioBJamesDifferentlyQuestion(c)) lastJamesIdx = i;
    if (looksLikeScenarioBRepairAsJamesQuestion(c)) lastRepairIdx = i;
  }

  if (lastRepairIdx > lastJamesIdx && lastRepairIdx >= 0) {
    return SCENARIO_B_JAMES_REPAIR_CANONICAL;
  }
  if (lastJamesIdx >= 0) {
    return SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
  }
  return SCENARIO_2_OPENING;
}
