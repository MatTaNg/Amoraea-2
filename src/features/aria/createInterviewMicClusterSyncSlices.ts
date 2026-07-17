import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewMicClusterLiveStateSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    voiceState: params.voiceState,
    currentTranscript: params.currentTranscript,
    audioRecorder: params.audioRecorder,
    interviewStatus: params.interviewStatus,
    messages: params.messages,
    useTapMicUi: params.useTapMicUi,
    touchActivity: params.touchActivity,
  };
}

export function createInterviewMicClusterSettersSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setMicWarning: params.setMicWarning,
    setMicEnginePrimed: params.setMicEnginePrimed,
    setMicPermission: params.setMicPermission,
    setCurrentTranscript: params.setCurrentTranscript,
    setMicNeedsReconnect: params.setMicNeedsReconnect,
    setMicSessionRecovering: params.setMicSessionRecovering,
    setLateStartIdleCueVisible: params.setLateStartIdleCueVisible,
    setPreInitMeterLevel: params.setPreInitMeterLevel,
    setSessionAudioHealthNotice: params.setSessionAudioHealthNotice,
    setConversationErrorNotice: params.setConversationErrorNotice,
  };
}

export function createInterviewMicClusterPlaybackGateSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    stopElevenLabsPlayback: params.stopElevenLabsPlayback,
    stopElevenLabsSpeech: params.stopElevenLabsSpeech,
    checkMicPermission: params.checkMicPermission,
    isInterviewerOutputActiveForMicGate: params.isInterviewerOutputActiveForMicGate,
    classifyInterviewQuestionType: params.classifyInterviewQuestionType,
  };
}

export function createInterviewMicClusterRecordingPipelineSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    handleRecordingError: params.handleRecordingError,
    processUserSpeech: params.processUserSpeech,
    transcribeSafe: params.transcribeSafe,
    processTurnAudioWithRetry: params.processTurnAudioWithRetry,
    takeRecordingStartEventDataWithVadBypassRestart: params.takeRecordingStartEventDataWithVadBypassRestart,
    deleteTurnAudioFile: params.deleteTurnAudioFile,
    deliverRecordingRetryLine: params.deliverRecordingRetryLine,
    classifyError: params.classifyError,
  };
}

export function createInterviewMicClusterRecordingRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    recognitionRef: params.recognitionRef,
    webMicArmInFlightRef: params.webMicArmInFlightRef,
    micTapWhileTtsActiveRef: params.micTapWhileTtsActiveRef,
    recordingDelayMeasurementRef: params.recordingDelayMeasurementRef,
    transcribeBufferMetaRef: params.transcribeBufferMetaRef,
    recordingPeakMeteringRef: params.recordingPeakMeteringRef,
    lastRecordingVadSpeechDetectedRef: params.lastRecordingVadSpeechDetectedRef,
    transcriptionFailureStreakRef: params.transcriptionFailureStreakRef,
    lastRecordingRetryDeliveredNormRef: params.lastRecordingRetryDeliveredNormRef,
    recordingCompleteInFlightRef: params.recordingCompleteInFlightRef,
    consecutiveDigitalSilenceForMicFallbackRef: params.consecutiveDigitalSilenceForMicFallbackRef,
    micFallbackSuccessPendingRef: params.micFallbackSuccessPendingRef,
    pendingRecordingRestartAfterVadBypassRef: params.pendingRecordingRestartAfterVadBypassRef,
    recoveryAssistantSpokenAtSubstantiveSeqRef: params.recoveryAssistantSpokenAtSubstantiveSeqRef,
    turnAudioIndexRef: params.turnAudioIndexRef,
    releaseRecordingFnRef: params.releaseRecordingFnRef,
  };
}

export function createInterviewMicClusterRouteProbeSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    lastHeadphoneProbeRef: params.lastHeadphoneProbeRef,
    lastAudioRouteFingerprintRef: params.lastAudioRouteFingerprintRef,
    applyRouteProbeAfterResume: params.applyRouteProbeAfterResume,
    navigation: params.navigation,
  };
}

export function createInterviewMicClusterWebTtsResumeSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    hasInterviewClosingSpeakInFlightForSession: params.hasInterviewClosingSpeakInFlightForSession,
    resumeRepeatPrefetchMpegRef: params.resumeRepeatPrefetchMpegRef,
  };
}

export function createInterviewMicClusterPressHandlersSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    handlePressStart: params.handlePressStart,
    handlePressEnd: params.handlePressEnd,
    startRecordingAfterPendingTts: params.startRecordingAfterPendingTts,
  };
}
