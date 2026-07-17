import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewEarlyDepsLiveStateSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    emotionItemsComplete: params.emotionItemsComplete,
    status: params.status,
    voiceState: params.voiceState,
    emotionModalVisible: params.emotionModalVisible,
    emotionModalItemIndex: params.emotionModalItemIndex,
  };
}

export function createInterviewEarlyDepsRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    statusRef: params.statusRef,
    emotionItemResponsesRef: params.emotionItemResponsesRef,
    emotionModalResolveRef: params.emotionModalResolveRef,
    emotionModalPendingTransitionRef: params.emotionModalPendingTransitionRef,
    emotionModalOpenForIndexRef: params.emotionModalOpenForIndexRef,
    emotionModalTimeoutRef: params.emotionModalTimeoutRef,
    emotionModalShownForScenarioRef: params.emotionModalShownForScenarioRef,
    pendingEmotionModalTransitionRef: params.pendingEmotionModalTransitionRef,
  };
}

export function createInterviewEarlyDepsOrchestrationSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    maybeAwaitEmotionAfterScenarioTransitionRef: params.maybeAwaitEmotionAfterScenarioTransitionRef,
    runEmotionModalAfterScenarioTransitionRef: params.runEmotionModalAfterScenarioTransitionRef,
    tryRunEmotionModalFromScenarioTransitionRef: params.tryRunEmotionModalFromScenarioTransitionRef,
  };
}

export function createInterviewEarlyDepsSettersSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setEmotionItemResponses: params.setEmotionItemResponses,
    setEmotionItemsComplete: params.setEmotionItemsComplete,
    setEmotionModalVisible: params.setEmotionModalVisible,
    setEmotionModalItemIndex: params.setEmotionModalItemIndex,
  };
}
