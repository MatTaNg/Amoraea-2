import type { MutableRefObject } from 'react';

import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';
import type { AriaInterviewEmotionClosingDepSyncWiringParams } from '@features/aria/hooks/useAriaInterviewEmotionClosingDepSyncWiring';
import type { useAriaInterviewSession } from '@features/aria/hooks/useAriaInterviewSession';
import type { ClosingQuestionActionsDeps } from '@features/aria/interviewClosingQuestionTypes';
import type { InterviewAssistantMetaExemptionDeps } from '@features/aria/interviewAssistantMetaExemptionTypes';

export type BuildAriaInterviewEmotionClosingDepSyncWiringParamsFromScreenInput = {
  closingQuestionActionsDepsRef: MutableRefObject<ClosingQuestionActionsDeps>;
  interviewAssistantMetaExemptionDepsRef: MutableRefObject<InterviewAssistantMetaExemptionDeps>;
  session: AriaInterviewScreenSessionState;
  interview: ReturnType<typeof useAriaInterviewSession>;
};

/** Assemble emotion-modal + closing-question dep-sync params from gate refs + live modal state. */
export function buildAriaInterviewEmotionClosingDepSyncWiringParamsFromScreen(
  input: BuildAriaInterviewEmotionClosingDepSyncWiringParamsFromScreenInput,
): AriaInterviewEmotionClosingDepSyncWiringParams {
  const { closingQuestionActionsDepsRef, interviewAssistantMetaExemptionDepsRef, session, interview } = input;
  const { status, voiceState } = interview;
  const { gate, shell } = session;
  const { emotionModalVisible, emotionModalItemIndex, emotionItemsComplete } = shell;
  const {
    recordInterviewAssistantDeliveryForMetaExemptionRef,
    finalizePendingMetaAckBaselineAfterAssistantTextRef,
  } = gate.metaSkip;

  return {
    closingQuestionActionsDepsRef,
    interviewAssistantMetaExemptionDepsRef,
    recordInterviewAssistantDeliveryForMetaExemptionRef,
    finalizePendingMetaAckBaselineAfterAssistantTextRef,
    emotionModalEffects: {
      emotionModalVisible,
      emotionModalItemIndex,
      emotionItemsComplete,
      status,
      voiceState,
    },
  };
}
