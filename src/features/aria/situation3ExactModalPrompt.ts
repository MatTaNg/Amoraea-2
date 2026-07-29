type ScenarioModalTranscriptTurn = { role: string; content?: string | null };

import { isIrrelevantAnswerRetryAssistantLine } from '@features/aria/interviewAnswerRelevance';
import { getLastSubstantiveScenarioModalQuestion } from '@features/aria/interviewScenarioModalPrompt';
import type { InterviewUiPhase } from '@features/aria/sessionLifecycleTypes';
import {
  detectActiveScenarioFromMessage,
  normalizeScenarioOpeningForCompare,
  SCENARIO_3_OPENING,
} from '@features/aria/interviewScenarioOpeningStreamGate';
import { SHOW_SCENARIO_3_VIGNETTE_EXACT } from '@features/aria/interviewShowScenarioExactCopy';
import {
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCRepairAsDanielQuestion,
  looksLikeScenarioCSophiePerspectiveQuestion,
  resolveScenarioCRepairModalPromptFromText,
} from '@features/aria/scenarioCPromptDetection';
import { looksLikeScenarioARepairQuestion } from '@features/aria/scenarioARepairQuestionHelpers';
import {
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
} from '@features/aria/scenarioBProbeLogic';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';

export type Situation3ModalDeliveryState = {
  sophiePerspectiveAsked?: boolean;
  danielRepairAsked?: boolean;
};

export const SITUATION_3_REFERENCE_SCENARIO: ActiveScenario = {
  label: 'Situation 3',
  text: SHOW_SCENARIO_3_VIGNETTE_EXACT,
};

function scopedSituation3AssistantTurns(
  transcript: ScenarioModalTranscriptTurn[],
): ScenarioModalTranscriptTurn[] {
  let anchorIdx = -1;
  for (let i = transcript.length - 1; i >= 0; i--) {
    if (transcript[i]?.role !== 'assistant') continue;
    const detected = detectActiveScenarioFromMessage((transcript[i]?.content ?? '').trim());
    if (detected?.label === 'Situation 3') {
      anchorIdx = i;
      break;
    }
  }
  return anchorIdx >= 0 ? transcript.slice(anchorIdx) : transcript;
}

function transcriptHasSophiePerspectiveProbe(transcript: ScenarioModalTranscriptTurn[]): boolean {
  return scopedSituation3AssistantTurns(transcript).some(
    (t) =>
      t.role === 'assistant' &&
      looksLikeScenarioCSophiePerspectiveQuestion((t.content ?? '').trim()),
  );
}

function transcriptHasDanielRepairProbe(transcript: ScenarioModalTranscriptTurn[]): boolean {
  return scopedSituation3AssistantTurns(transcript).some(
    (t) =>
      t.role === 'assistant' &&
      (looksLikeScenarioCRepairAsDanielQuestion((t.content ?? '').trim()) ||
        isScenarioCRepairAssistantPrompt((t.content ?? '').trim())),
  );
}

function lastScenarioCRepairAssistantContent(
  scoped: ScenarioModalTranscriptTurn[],
): string | null {
  for (let i = scoped.length - 1; i >= 0; i--) {
    if (scoped[i]?.role !== 'assistant') continue;
    const c = (scoped[i]?.content ?? '').trim();
    if (looksLikeScenarioCRepairAsDanielQuestion(c) || isScenarioCRepairAssistantPrompt(c)) {
      return c;
    }
  }
  return null;
}

/** True when Situation 3 modal must not revert to the opening question. */
export function isSituation3ModalAdvancedPastOpening(
  delivery?: Situation3ModalDeliveryState | null,
  lastQuestionText?: string | null,
  transcript?: ScenarioModalTranscriptTurn[],
): boolean {
  if (delivery?.danielRepairAsked || delivery?.sophiePerspectiveAsked) return true;
  const last = (lastQuestionText ?? '').trim();
  if (last) {
    if (
      looksLikeScenarioCSophiePerspectiveQuestion(last) ||
      looksLikeScenarioCRepairAsDanielQuestion(last) ||
      isScenarioCRepairAssistantPrompt(last)
    ) {
      return true;
    }
  }
  if (transcript?.length) {
    return transcriptHasDanielRepairProbe(transcript) || transcriptHasSophiePerspectiveProbe(transcript);
  }
  return false;
}

/**
 * Situation 3 Show scenario footer — exact scripted copy only (opening → Sophie perspective → repair Q2).
 */
export function resolveSituation3ExactModalPrompt(
  transcript: ScenarioModalTranscriptTurn[],
  currentSpoken?: string | null,
  delivery?: Situation3ModalDeliveryState | null,
): string {
  const spoken = (currentSpoken ?? '').trim();
  const spokenIsPriorScenarioBleed =
    spoken &&
    (looksLikeScenarioARepairQuestion(spoken) ||
      looksLikeScenarioBRepairAsJamesQuestion(spoken) ||
      looksLikeScenarioBJamesDifferentlyQuestion(spoken));
  if (spoken && !spokenIsPriorScenarioBleed && !isIrrelevantAnswerRetryAssistantLine(spoken)) {
    if (
      looksLikeScenarioCRepairAsDanielQuestion(spoken) ||
      isScenarioCRepairAssistantPrompt(spoken)
    ) {
      return resolveScenarioCRepairModalPromptFromText(spoken);
    }
    if (looksLikeScenarioCSophiePerspectiveQuestion(spoken)) {
      return SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
    }
  }

  const scoped = scopedSituation3AssistantTurns(transcript);
  const lastSubstantive = getLastSubstantiveScenarioModalQuestion(scoped);
  if (lastSubstantive) {
    if (
      looksLikeScenarioCRepairAsDanielQuestion(lastSubstantive) ||
      isScenarioCRepairAssistantPrompt(lastSubstantive)
    ) {
      return resolveScenarioCRepairModalPromptFromText(lastSubstantive);
    }
    if (looksLikeScenarioCSophiePerspectiveQuestion(lastSubstantive)) {
      return SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
    }
    if (
      normalizeScenarioOpeningForCompare(lastSubstantive) ===
      normalizeScenarioOpeningForCompare(SCENARIO_3_OPENING)
    ) {
      return SCENARIO_3_OPENING;
    }
  }

  // Resume / delivery-ref fallback when transcript lacks explicit probe lines.
  if (delivery?.danielRepairAsked) {
    const lastRepair = lastScenarioCRepairAssistantContent(scoped);
    if (lastRepair) {
      return resolveScenarioCRepairModalPromptFromText(lastRepair);
    }
  }
  if (delivery?.sophiePerspectiveAsked && transcriptHasSophiePerspectiveProbe(scoped)) {
    return SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
  }

  return SCENARIO_3_OPENING;
}

export function readSituation3DeliveryState(
  assistantForModal: ScenarioModalTranscriptTurn[],
): Situation3ModalDeliveryState {
  return {
    sophiePerspectiveAsked: transcriptHasSophiePerspectiveProbe(assistantForModal),
    danielRepairAsked: transcriptHasDanielRepairProbe(assistantForModal),
  };
}

export function applySituation3ExactModalPrompt(
  deps: {
    setReferenceCardPrompt: (prompt: string) => void;
    lastQuestionTextRef?: { current: string };
  },
  assistantForModal: ScenarioModalTranscriptTurn[],
  currentSpoken?: string | null,
  delivery?: Situation3ModalDeliveryState | null,
): void {
  const exact = resolveSituation3ExactModalPrompt(
    assistantForModal,
    currentSpoken,
    delivery ?? readSituation3DeliveryState(assistantForModal),
  );
  deps.setReferenceCardPrompt(exact);
  if (deps.lastQuestionTextRef) {
    deps.lastQuestionTextRef.current = exact;
  }
}

/** Show-scenario modal body + footer for Situation 3 (vignette must not stay on a prior scenario). */
export function applySituation3ReferenceCard(
  deps: {
    committedScenarioRef?: { current: ActiveScenario | null };
    setReferenceCardScenario: (scenario: ActiveScenario) => void;
    setReferenceCardPrompt: (prompt: string) => void;
    setInterviewUiPhase: (phase: InterviewUiPhase) => void;
    lastQuestionTextRef?: { current: string };
  },
  assistantForModal: ScenarioModalTranscriptTurn[],
  currentSpoken?: string | null,
  delivery?: Situation3ModalDeliveryState | null,
): void {
  if (deps.committedScenarioRef) {
    deps.committedScenarioRef.current = SITUATION_3_REFERENCE_SCENARIO;
  }
  deps.setReferenceCardScenario(SITUATION_3_REFERENCE_SCENARIO);
  deps.setInterviewUiPhase('scenario_active');
  applySituation3ExactModalPrompt(deps, assistantForModal, currentSpoken, delivery);
}
