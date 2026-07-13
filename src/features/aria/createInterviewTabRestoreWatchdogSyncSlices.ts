import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewTabRestoreWatchdogVoiceSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    voiceStateRef: params.voiceStateRef,
    interviewStatusRef: params.interviewStatusRef,
    setVoiceState: params.setVoiceState,
  };
}

export function createInterviewTabRestoreWatchdogOverlaySyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    webTabGestureRestoreOverlayRef: params.webTabGestureRestoreOverlayRef,
    setWebTabRestoreOverlayVisible: params.setWebTabRestoreOverlayVisible,
    setWebInterviewerOutputActive: params.setWebInterviewerOutputActive,
    dismissTabRestoreOverlay: params.dismissTabRestoreOverlay,
    dismissAfterAndroidBackgroundPlaybackEnd: params.dismissAfterAndroidBackgroundPlaybackEnd,
    tabRestoreHtmlPlayStartTimeoutMs: params.tabRestoreHtmlPlayStartTimeoutMs,
  };
}

export function createInterviewTabRestoreWatchdogTtsFlightSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    ttsLineInFlightRef: params.ttsLineInFlightRef,
    parallelStreamingTtsRef: params.parallelStreamingTtsRef,
    webTtsUtteranceInFlightRef: params.webTtsUtteranceInFlightRef,
    webTtsTabInterruptPendingReplayRef: params.webTtsTabInterruptPendingReplayRef,
    webTabRestoreReplayInFlightRef: params.webTabRestoreReplayInFlightRef,
    webTabRestoreDeliveredNormRef: params.webTabRestoreDeliveredNormRef,
    lastSuccessfulTtsTextNormalizedRef: params.lastSuccessfulTtsTextNormalizedRef,
    staleWebTtsRuntimeLockSinceMsRef: params.staleWebTtsRuntimeLockSinceMsRef,
    tabRestoreInFlightWithoutPlaybackSinceMsRef: params.tabRestoreInFlightWithoutPlaybackSinceMsRef,
    speakingWithoutPlaybackSinceMsRef: params.speakingWithoutPlaybackSinceMsRef,
    interruptAllWebInterviewTtsOutput: params.interruptAllWebInterviewTtsOutput,
  };
}

export function createInterviewTabRestoreWatchdogPlaybackSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    mobileTabHideLetPlaybackContinueRef: params.mobileTabHideLetPlaybackContinueRef,
    pendingGestureRestoreSpeakRef: params.pendingGestureRestoreSpeakRef,
    needsGestureRestoreRef: params.needsGestureRestoreRef,
    isWebInterviewPlaybackSurfaceActive: params.isWebInterviewPlaybackSurfaceActive,
    isWebInterviewPlaybackAudiblyActive: params.isWebInterviewPlaybackAudiblyActive,
    hasWebInterviewHtmlAudioTabResumePending: params.hasWebInterviewHtmlAudioTabResumePending,
    isWebInterviewMidUtteranceTabResumeActive: params.isWebInterviewMidUtteranceTabResumeActive,
    isInterviewerOutputActiveForMicGate: params.isInterviewerOutputActiveForMicGate,
  };
}

export function createInterviewTabRestoreWatchdogRecoverySyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    queueMobileWebHtmlResumeAfterScreenReturn: params.queueMobileWebHtmlResumeAfterScreenReturn,
    resolveStaleWebTtsRuntimeLockThresholdMs: params.resolveStaleWebTtsRuntimeLockThresholdMs,
    clearStaleWebInterviewTtsRuntimeLocks: params.clearStaleWebInterviewTtsRuntimeLocks,
    ensureWebGestureFlushListener: params.ensureWebGestureFlushListener,
  };
}
