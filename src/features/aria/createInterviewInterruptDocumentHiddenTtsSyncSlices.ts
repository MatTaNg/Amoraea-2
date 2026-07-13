import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewInterruptDocumentHiddenIdentitySyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    interviewStatusRef: params.interviewStatusRef,
    userIdRef: params.userIdRef,
  };
}

export function createInterviewInterruptDocumentHiddenTtsFlightSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    ttsLineInFlightRef: params.ttsLineInFlightRef,
    parallelStreamingTtsRef: params.parallelStreamingTtsRef,
    webTtsUtteranceInFlightRef: params.webTtsUtteranceInFlightRef,
    webTtsTabInterruptPendingReplayRef: params.webTtsTabInterruptPendingReplayRef,
    webTtsSpeakGenerationRef: params.webTtsSpeakGenerationRef,
    lastQuestionTextRef: params.lastQuestionTextRef,
    webTabRestoreDeliveredNormRef: params.webTabRestoreDeliveredNormRef,
    webTabRestoreReplayInFlightRef: params.webTabRestoreReplayInFlightRef,
  };
}

export function createInterviewInterruptDocumentHiddenPlaybackSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    isWebInterviewPlaybackSurfaceActive: params.isWebInterviewPlaybackSurfaceActive,
    gestureContextLostAtRef: params.gestureContextLostAtRef,
    isMobileWebInterviewTtsSessionActive: params.isMobileWebInterviewTtsSessionActive,
    armMobileWebBackgroundTtsContinue: params.armMobileWebBackgroundTtsContinue,
    tabHiddenDuringActiveTtsLineRef: params.tabHiddenDuringActiveTtsLineRef,
    mobileTabHideLetPlaybackContinueRef: params.mobileTabHideLetPlaybackContinueRef,
    mobileTabHideBackgroundUtteranceRef: params.mobileTabHideBackgroundUtteranceRef,
  };
}

export function createInterviewInterruptDocumentHiddenGestureSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    pendingGestureRestoreSpeakRef: params.pendingGestureRestoreSpeakRef,
    needsGestureRestoreRef: params.needsGestureRestoreRef,
    tabVisibilityGestureLossPendingRef: params.tabVisibilityGestureLossPendingRef,
    setWebTabRestoreOverlayVisible: params.setWebTabRestoreOverlayVisible,
    setTtsPlaybackActive: params.setTtsPlaybackActive,
    setVoiceState: params.setVoiceState,
  };
}
