import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';

import type { EmotionModalOrchestrationDeps } from '@features/aria/emotionModalOrchestrationTypes';
import type { ClosingQuestionActionsDeps } from '@features/aria/interviewClosingQuestionTypes';
import type { InterviewAssistantMetaExemptionDeps } from '@features/aria/interviewAssistantMetaExemptionTypes';
import {
  useInterviewEmotionModalOrchestration,
  type EmotionModalOrchestrationEffectInputs,
} from '@features/aria/hooks/useInterviewEmotionModalOrchestration';
import {
  runFinalizePendingMetaAckBaselineAfterAssistantText,
  runRecordInterviewAssistantDeliveryForMetaExemption,
} from '@features/aria/runInterviewAssistantMetaExemption';
import {
  runMarkClosingQuestionAnswered,
  runMarkClosingQuestionAsked,
} from '@features/aria/runInterviewClosingQuestionActions';

export type AriaInterviewEmotionClosingDepSyncWiringParams = {
  closingQuestionActionsDepsRef: MutableRefObject<ClosingQuestionActionsDeps>;
  interviewAssistantMetaExemptionDepsRef: MutableRefObject<InterviewAssistantMetaExemptionDeps>;
  recordInterviewAssistantDeliveryForMetaExemptionRef: MutableRefObject<(deliveredQuestionText: string) => void>;
  finalizePendingMetaAckBaselineAfterAssistantTextRef: MutableRefObject<(fullAssistantText: string) => void>;
  emotionModalEffects: EmotionModalOrchestrationEffectInputs;
};

/** Wire emotion-modal orchestration, meta-exemption ref bridges, and closing-question actions. */
export function useAriaInterviewEmotionClosingDepSyncWiring(params: AriaInterviewEmotionClosingDepSyncWiringParams) {
  const {
    closingQuestionActionsDepsRef,
    interviewAssistantMetaExemptionDepsRef,
    recordInterviewAssistantDeliveryForMetaExemptionRef,
    finalizePendingMetaAckBaselineAfterAssistantTextRef,
    emotionModalEffects,
  } = params;

  const emotionModalOrchestrationDepsRef = useRef({} as EmotionModalOrchestrationDeps);

  const {
    loadEmotionResponsesForCompletion,
    applyEmotionResponsesToSession,
    handleEmotionInterviewAnswer,
    awaitEmotionModalForIndex,
    runEmotionModalAfterScenarioTransition,
    tryRunEmotionModalFromScenarioTransition,
  } = useInterviewEmotionModalOrchestration(emotionModalOrchestrationDepsRef, emotionModalEffects);

  recordInterviewAssistantDeliveryForMetaExemptionRef.current = (deliveredQuestionText: string) => {
    runRecordInterviewAssistantDeliveryForMetaExemption(
      interviewAssistantMetaExemptionDepsRef.current,
      deliveredQuestionText,
    );
  };
  finalizePendingMetaAckBaselineAfterAssistantTextRef.current = (fullAssistantText: string) => {
    runFinalizePendingMetaAckBaselineAfterAssistantText(
      interviewAssistantMetaExemptionDepsRef.current,
      fullAssistantText,
    );
  };

  const markClosingQuestionAsked = useCallback(
    (scenarioNumber: 1 | 2 | 3) =>
      runMarkClosingQuestionAsked(closingQuestionActionsDepsRef.current, scenarioNumber),
    [closingQuestionActionsDepsRef],
  );
  const markClosingQuestionAnswered = useCallback(
    (scenarioNumber: 1 | 2 | 3) =>
      runMarkClosingQuestionAnswered(closingQuestionActionsDepsRef.current, scenarioNumber),
    [closingQuestionActionsDepsRef],
  );

  return {
    emotionModalOrchestrationDepsRef,
    loadEmotionResponsesForCompletion,
    applyEmotionResponsesToSession,
    handleEmotionInterviewAnswer,
    awaitEmotionModalForIndex,
    runEmotionModalAfterScenarioTransition,
    tryRunEmotionModalFromScenarioTransition,
    markClosingQuestionAsked,
    markClosingQuestionAnswered,
  };
}
