import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewRuntimeIdentitySyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userId: params.userId,
    isAdmin: params.isAdmin,
    isInterviewAppRoute: params.isInterviewAppRoute,
  };
}

export function createInterviewRuntimeSessionRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userIdRef: params.userIdRef,
    interviewSessionAttemptIdRef: params.interviewSessionAttemptIdRef,
    interviewSessionIdRef: params.interviewSessionIdRef,
    interviewStatusRef: params.interviewStatusRef,
  };
}

export function createInterviewRuntimeVoiceStateSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    voiceStateRef: params.voiceStateRef,
    setVoiceState: params.setVoiceState,
    lastQuestionTextRef: params.lastQuestionTextRef,
  };
}

export function createInterviewRuntimeTtsFlightSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    parallelStreamingTtsRef: params.parallelStreamingTtsRef,
    ttsLineInFlightRef: params.ttsLineInFlightRef,
    ttsSpeakGenerationRef: params.ttsSpeakGenerationRef,
    ttsUtteranceInFlightRef: params.ttsUtteranceInFlightRef,
    ttsUtteranceInFlightOptionsRef: params.ttsUtteranceInFlightOptionsRef,
  };
}

export function createInterviewRuntimeRecordingTimingSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    recordingJustFinishedBeforeNextTtsRef: params.recordingJustFinishedBeforeNextTtsRef,
    postRecordingParallelStreamSettleRef: params.postRecordingParallelStreamSettleRef,
    transcriptAtReleaseRef: params.transcriptAtReleaseRef,
    timingRef: params.timingRef,
  };
}

export function createInterviewRuntimeResumeRepeatSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    resumeLastAssistantTextRef: params.resumeLastAssistantTextRef,
    resumeRepeatChoicePendingRef: params.resumeRepeatChoicePendingRef,
    resumeRepeatPrefetchMpegRef: params.resumeRepeatPrefetchMpegRef,
  };
}

export function createInterviewRuntimeTurnMetadataSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    whisperRatioReaskAttemptsForCurrentQuestionRef: params.whisperRatioReaskAttemptsForCurrentQuestionRef,
    metaCommentAckAwaitingSubstantiveBaselineSeqRef: params.metaCommentAckAwaitingSubstantiveBaselineSeqRef,
    substantiveInterviewQuestionDeliveredSeqRef: params.substantiveInterviewQuestionDeliveredSeqRef,
    lastVoiceTurnLanguageRef: params.lastVoiceTurnLanguageRef,
    lastVoiceTurnConfidenceRef: params.lastVoiceTurnConfidenceRef,
    lastUserTurnAudioDurationMsRef: params.lastUserTurnAudioDurationMsRef,
    lastUserTurnMicStopTelemetryRef: params.lastUserTurnMicStopTelemetryRef,
  };
}

export function createInterviewRuntimeInterruptSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    interruptAllInterviewTtsOutput: params.interruptAllInterviewTtsOutput,
  };
}
