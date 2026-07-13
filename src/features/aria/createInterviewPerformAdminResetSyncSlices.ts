import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewPerformAdminResetIdentitySyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userId: params.userId,
    isAdmin: params.isAdmin,
  };
}

export function createInterviewPerformAdminResetMediaSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    useMediaRecorderPath: params.useMediaRecorderPath,
    audioRecorder: params.audioRecorder,
    recognitionRef: params.recognitionRef,
    stopElevenLabsPlayback: params.stopElevenLabsPlayback,
    stopElevenLabsSpeech: params.stopElevenLabsSpeech,
    clearInterviewFromStorage: params.clearInterviewFromStorage,
    setInterviewJustCompletedInSession: params.setInterviewJustCompletedInSession,
  };
}

export function createInterviewPerformAdminResetSessionRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    isInterviewCompleteRef: params.isInterviewCompleteRef,
    hasResumedRef: params.hasResumedRef,
    scoredScenariosRef: params.scoredScenariosRef,
    onboardingAutoStartRef: params.onboardingAutoStartRef,
    currentScenarioRef: params.currentScenarioRef,
    timingRef: params.timingRef,
    lastQuestionTextRef: params.lastQuestionTextRef,
    transcriptAtReleaseRef: params.transcriptAtReleaseRef,
    pendingCompletionTranscriptRef: params.pendingCompletionTranscriptRef,
    waitingMessageIdRef: params.waitingMessageIdRef,
    committedScenarioRef: params.committedScenarioRef,
    isSpeakingRef: params.isSpeakingRef,
    responseTimingsRef: params.responseTimingsRef,
    probeLogRef: params.probeLogRef,
  };
}

export function createInterviewPerformAdminResetClosingQuestionSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    closingQuestionAskedRef: params.closingQuestionAskedRef,
    closingQuestionAnsweredRef: params.closingQuestionAnsweredRef,
    lastClosingQuestionScenarioRef: params.lastClosingQuestionScenarioRef,
    waitingForClosingAdditionRef: params.waitingForClosingAdditionRef,
    lastAnsweredClosingScenarioRef: params.lastAnsweredClosingScenarioRef,
    setClosingQuestionState: params.setClosingQuestionState,
    setClosingQuestionPending: params.setClosingQuestionPending,
    setClosingQuestionScenario: params.setClosingQuestionScenario,
  };
}

export function createInterviewPerformAdminResetInterviewResetSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setMessages: params.setMessages,
    setScenarioScores: params.setScenarioScores,
    setMicError: params.setMicError,
    setMicWarning: params.setMicWarning,
    setResults: params.setResults,
    setAnalysisAttemptId: params.setAnalysisAttemptId,
    setPendingScoringSyncAttemptId: params.setPendingScoringSyncAttemptId,
    setInterviewLastCommittedAttemptId: params.setInterviewLastCommittedAttemptId,
    setHighestScenarioReached: params.setHighestScenarioReached,
    setStageResults: params.setStageResults,
    setTouchedConstructs: params.setTouchedConstructs,
    setExchangeCount: params.setExchangeCount,
    setIsWaiting: params.setIsWaiting,
    setCurrentTranscript: params.setCurrentTranscript,
    setTypedAnswer: params.setTypedAnswer,
    setUsedPersonalExamples: params.setUsedPersonalExamples,
    setPendingCompletion: params.setPendingCompletion,
    setInterviewUiPhase: params.setInterviewUiPhase,
    setReferenceCardScenario: params.setReferenceCardScenario,
    setReferenceCardPrompt: params.setReferenceCardPrompt,
    setVoiceState: params.setVoiceState,
    resetInterviewProgressRefs: params.resetInterviewProgressRefs,
    startInterview: params.startInterview,
  };
}

export function createInterviewPerformAdminResetPostInterviewSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setShowPostInterviewFeedback: params.setShowPostInterviewFeedback,
    setPostInterviewRatings: params.setPostInterviewRatings,
    setPostInterviewComments: params.setPostInterviewComments,
    setPostInterviewGeneralFeedback: params.setPostInterviewGeneralFeedback,
    setHasSubmittedPostInterviewFeedback: params.setHasSubmittedPostInterviewFeedback,
  };
}
