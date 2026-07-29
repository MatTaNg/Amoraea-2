import { useRef } from 'react';

import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';
import type { PendingEmotionModalTransition } from '@features/aria/emotionRecognitionInterview';

export type AriaInterviewSessionResumeEmotionGateRefsParams = {
  setEmotionModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setEmotionModalItemIndex: React.Dispatch<React.SetStateAction<number>>;
  setEmotionItemResponses: React.Dispatch<React.SetStateAction<string[]>>;
  setEmotionItemsComplete: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useAriaInterviewSessionResumeEmotionGateRefs(
  params: AriaInterviewSessionResumeEmotionGateRefsParams,
) {
  const emotionItemResponsesRef = useRef<string[]>([]);
  const emotionModalResolveRef = useRef<(() => void) | null>(null);
  const emotionModalPendingTransitionRef = useRef(false);
  const emotionModalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emotionModalShownForScenarioRef = useRef<Set<1 | 2 | 3>>(new Set());
  const pendingEmotionModalTransitionRef = useRef<PendingEmotionModalTransition | null>(null);
  const resumeEmotionAfterModalTextRef = useRef<string | null>(null);
  const resumeOfferWelcomeTtsRef = useRef(true);
  const resumeInPersonalPartRef = useRef(false);
  const resumeWelcomeHydrationAttemptRef = useRef<string | null>(null);
  const resumeActiveScenarioRef = useRef<1 | 2 | 3 | null>(null);
  const resumeWelcomeMessageRef = useRef(preamble.RESUME_WELCOME_BACK_MESSAGE);
  const pendingScenarioIntroAfterResumeWelcomeRef = useRef<string | null>(null);
  const transcriptScenarioLogCursorRef = useRef(0);
  const resumeRepeatChoicePendingRef = useRef(false);
  const resumeLastAssistantTextRef = useRef<string | null>(null);
  const resumeRepeatPrefetchMpegRef = useRef<{ text: string; buffer: ArrayBuffer } | null>(null);
  const resumeClosingRepeatSpeakInFlightRef = useRef(false);

  return {
    emotionItemResponsesRef,
    emotionModalResolveRef,
    emotionModalPendingTransitionRef,
    emotionModalTimeoutRef,
    emotionModalShownForScenarioRef,
    pendingEmotionModalTransitionRef,
    resumeEmotionAfterModalTextRef,
    resumeOfferWelcomeTtsRef,
    resumeInPersonalPartRef,
    resumeWelcomeHydrationAttemptRef,
    resumeActiveScenarioRef,
    resumeWelcomeMessageRef,
    pendingScenarioIntroAfterResumeWelcomeRef,
    transcriptScenarioLogCursorRef,
    resumeRepeatChoicePendingRef,
    resumeLastAssistantTextRef,
    resumeRepeatPrefetchMpegRef,
    resumeClosingRepeatSpeakInFlightRef,
    setEmotionModalVisible: params.setEmotionModalVisible,
    setEmotionModalItemIndex: params.setEmotionModalItemIndex,
    setEmotionItemResponses: params.setEmotionItemResponses,
    setEmotionItemsComplete: params.setEmotionItemsComplete,
  };
}
