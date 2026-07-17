import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewWebSpeechRecognitionSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    recognitionRef: params.recognitionRef,
    setCurrentTranscript: params.setCurrentTranscript,
    transcriptAtReleaseRef: params.transcriptAtReleaseRef,
    setMicError: params.setMicError,
    setMicWarning: params.setMicWarning,
  };
}

export function createInterviewHandleRecordingErrorSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    useWebCopy: params.useWebCopy,
    setVoiceState: params.setVoiceState,
    setMessages: params.setMessages,
    speakTextSafe: params.speakTextSafe,
  };
}

export function createInterviewApplyRouteProbeAfterResumeSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userIdRef: params.userIdRef,
    lastAudioRouteFingerprintRef: params.lastAudioRouteFingerprintRef,
    lastHeadphoneProbeRef: params.lastHeadphoneProbeRef,
    setAudioRouteKind: params.setAudioRouteKind,
  };
}

export function createInterviewHandleSendTypedSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userId: params.userId,
    ttsLineInFlightRef: params.ttsLineInFlightRef,
    lastVoiceTurnLanguageRef: params.lastVoiceTurnLanguageRef,
    lastVoiceTurnConfidenceRef: params.lastVoiceTurnConfidenceRef,
    touchActivity: params.touchActivity,
    setTypedAnswer: params.setTypedAnswer,
    setMicWarning: params.setMicWarning,
    stopElevenLabsSpeech: params.stopElevenLabsSpeech,
    processUserSpeech: params.processUserSpeech,
  };
}
