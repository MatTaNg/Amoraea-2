import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewWebResumeWelcomeTapSessionSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    interviewSessionAttemptIdRef: params.interviewSessionAttemptIdRef,
    isInterviewCompleteRef: params.isInterviewCompleteRef,
    interviewStatusRef: params.interviewStatusRef,
    currentMessagesRef: params.currentMessagesRef,
  };
}

export function createInterviewWebResumeWelcomeTapWebGestureSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    pendingWebSpeechForGestureRef: params.pendingWebSpeechForGestureRef,
    detachWebGestureFlushListener: params.detachWebGestureFlushListener,
    setWebDesktopPendingTtsGestureOverlay: params.setWebDesktopPendingTtsGestureOverlay,
    setMobileWebTapToBeginDone: params.setMobileWebTapToBeginDone,
  };
}

export function createInterviewWebResumeWelcomeTapSpeechSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    speakTextSafe: params.speakTextSafe,
    resumeLastAssistantTextRef: params.resumeLastAssistantTextRef,
    lastQuestionTextRef: params.lastQuestionTextRef,
  };
}

export function createInterviewWebResumeWelcomeTapEmotionSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    emotionModalPendingTransitionRef: params.emotionModalPendingTransitionRef,
    setEmotionModalVisible: params.setEmotionModalVisible,
    resumeEmotionCatchUpIndicesRef: params.resumeEmotionCatchUpIndicesRef,
    awaitEmotionModalForIndex: params.awaitEmotionModalForIndex,
    resumeEmotionAfterModalTextRef: params.resumeEmotionAfterModalTextRef,
  };
}

export function createInterviewWebResumeWelcomeTapResumeFlowSyncSlice(
  params: SyncExtraParams,
): SyncExtraParams {
  return {
    webResumeWelcomeTapHandledRef: params.webResumeWelcomeTapHandledRef,
    webResumeWelcomeTapPendingRef: params.webResumeWelcomeTapPendingRef,
    setWebResumeWelcomeTapPending: params.setWebResumeWelcomeTapPending,
    resumeOfferWelcomeTtsRef: params.resumeOfferWelcomeTtsRef,
    resumeWelcomeMessageRef: params.resumeWelcomeMessageRef,
    pendingScenarioIntroAfterResumeWelcomeRef: params.pendingScenarioIntroAfterResumeWelcomeRef,
    resumeRepeatChoicePendingRef: params.resumeRepeatChoicePendingRef,
  };
}
