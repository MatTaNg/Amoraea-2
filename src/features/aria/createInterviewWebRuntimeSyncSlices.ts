import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewWebRuntimeIdentitySyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userId: params.userId,
    isAdmin: params.isAdmin,
    isInterviewAppRoute: params.isInterviewAppRoute,
  };
}

export function createInterviewWebRuntimeSessionRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userIdRef: params.userIdRef,
    interviewSessionAttemptIdRef: params.interviewSessionAttemptIdRef,
    interviewSessionIdRef: params.interviewSessionIdRef,
    interviewStatusRef: params.interviewStatusRef,
  };
}

export function createInterviewWebRuntimeVoiceStateSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    voiceStateRef: params.voiceStateRef,
    setVoiceState: params.setVoiceState,
    lastQuestionTextRef: params.lastQuestionTextRef,
  };
}

export function createInterviewWebRuntimeTtsFlightSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    parallelStreamingTtsRef: params.parallelStreamingTtsRef,
    ttsLineInFlightRef: params.ttsLineInFlightRef,
    webTabRestoreReplayInFlightRef: params.webTabRestoreReplayInFlightRef,
    webTtsTabInterruptPendingReplayRef: params.webTtsTabInterruptPendingReplayRef,
    webTtsSpeakGenerationRef: params.webTtsSpeakGenerationRef,
    webTtsUtteranceInFlightRef: params.webTtsUtteranceInFlightRef,
    webTtsUtteranceInFlightOptionsRef: params.webTtsUtteranceInFlightOptionsRef,
  };
}

export function createInterviewWebRuntimeGestureRestoreSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    pendingGestureRestoreSpeakRef: params.pendingGestureRestoreSpeakRef,
    needsGestureRestoreRef: params.needsGestureRestoreRef,
    tabVisibilityGestureLossPendingRef: params.tabVisibilityGestureLossPendingRef,
    gestureContextLostAtRef: params.gestureContextLostAtRef,
    lastSuccessfulTtsTextNormalizedRef: params.lastSuccessfulTtsTextNormalizedRef,
    ensureWebGestureFlushListener: params.ensureWebGestureFlushListener,
    detachWebGestureFlushListener: params.detachWebGestureFlushListener,
    setWebTabRestoreOverlayVisible: params.setWebTabRestoreOverlayVisible,
    setMobileWebTapToBeginDone: params.setMobileWebTapToBeginDone,
    pendingWebSpeechForGestureRef: params.pendingWebSpeechForGestureRef,
  };
}

export function createInterviewWebRuntimeTabHidePlaybackSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    mobileTabHideLetPlaybackContinueRef: params.mobileTabHideLetPlaybackContinueRef,
    mobileTabHideBackgroundUtteranceRef: params.mobileTabHideBackgroundUtteranceRef,
    tabHiddenDuringActiveTtsLineRef: params.tabHiddenDuringActiveTtsLineRef,
  };
}

export function createInterviewWebRuntimeRecordingTimingSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    recordingJustFinishedBeforeNextTtsRef: params.recordingJustFinishedBeforeNextTtsRef,
    postRecordingParallelStreamSettleRef: params.postRecordingParallelStreamSettleRef,
    transcriptAtReleaseRef: params.transcriptAtReleaseRef,
    timingRef: params.timingRef,
  };
}

export function createInterviewWebRuntimeResumeRepeatSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    resumeLastAssistantTextRef: params.resumeLastAssistantTextRef,
    resumeRepeatChoicePendingRef: params.resumeRepeatChoicePendingRef,
    resumeRepeatPrefetchMpegRef: params.resumeRepeatPrefetchMpegRef,
  };
}

export function createInterviewWebRuntimeTurnMetadataSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    whisperRatioReaskAttemptsForCurrentQuestionRef: params.whisperRatioReaskAttemptsForCurrentQuestionRef,
    metaCommentAckAwaitingSubstantiveBaselineSeqRef: params.metaCommentAckAwaitingSubstantiveBaselineSeqRef,
    substantiveInterviewQuestionDeliveredSeqRef: params.substantiveInterviewQuestionDeliveredSeqRef,
    lastVoiceTurnLanguageRef: params.lastVoiceTurnLanguageRef,
    lastVoiceTurnConfidenceRef: params.lastVoiceTurnConfidenceRef,
    lastUserTurnAudioDurationMsRef: params.lastUserTurnAudioDurationMsRef,
  };
}

export function createInterviewWebRuntimeInterruptSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    interruptAllWebInterviewTtsOutput: params.interruptAllWebInterviewTtsOutput,
  };
}
