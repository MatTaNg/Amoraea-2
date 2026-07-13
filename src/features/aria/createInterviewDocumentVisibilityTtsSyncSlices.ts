import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewDocumentVisibilityHandlerSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    docVisibilityWasHiddenRef: params.docVisibilityWasHiddenRef,
    interruptInterviewTtsForDocumentHidden: params.interruptInterviewTtsForDocumentHidden,
    syncInterviewTtsAfterScreenReturn: params.syncInterviewTtsAfterScreenReturn,
    ensureWebGestureFlushListener: params.ensureWebGestureFlushListener,
    handleWebTabGestureRestoreTapRef: params.handleWebTabGestureRestoreTapRef,
  };
}

export function createInterviewDocumentVisibilitySessionSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    interviewStatusRef: params.interviewStatusRef,
    isInterviewCompleteRef: params.isInterviewCompleteRef,
    currentMessagesRef: params.currentMessagesRef,
  };
}

export function createInterviewDocumentVisibilityRestoreSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    webTabRestoreReplayInFlightRef: params.webTabRestoreReplayInFlightRef,
    needsGestureRestoreRef: params.needsGestureRestoreRef,
    tabVisibilityGestureLossPendingRef: params.tabVisibilityGestureLossPendingRef,
    setWebTabRestoreOverlayVisible: params.setWebTabRestoreOverlayVisible,
    mobileTabHideLetPlaybackContinueRef: params.mobileTabHideLetPlaybackContinueRef,
    pendingGestureRestoreSpeakRef: params.pendingGestureRestoreSpeakRef,
    tabHiddenDuringActiveTtsLineRef: params.tabHiddenDuringActiveTtsLineRef,
    hasWebInterviewHtmlAudioTabResumePending: params.hasWebInterviewHtmlAudioTabResumePending,
    isWebInterviewPlaybackAudiblyActive: params.isWebInterviewPlaybackAudiblyActive,
    committedScenarioRef: params.committedScenarioRef,
    isAssistantBubbleForTranscript: params.isAssistantBubbleForTranscript,
    setInterviewUiPhase: params.setInterviewUiPhase,
    setReferenceCardPrompt: params.setReferenceCardPrompt,
    setReferenceCardScenario: params.setReferenceCardScenario,
  };
}
