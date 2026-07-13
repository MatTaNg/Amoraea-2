import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewPerformRetakeIdentitySyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userId: params.userId,
    interviewStatusRef: params.interviewStatusRef,
  };
}

export function createInterviewPerformRetakeSessionRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    currentInterviewMomentRef: params.currentInterviewMomentRef,
    lastQuestionTextRef: params.lastQuestionTextRef,
    isInterviewCompleteRef: params.isInterviewCompleteRef,
    scoredScenariosRef: params.scoredScenariosRef,
    probeLogRef: params.probeLogRef,
    responseTimingsRef: params.responseTimingsRef,
    onboardingAutoStartRef: params.onboardingAutoStartRef,
  };
}

export function createInterviewPerformRetakeClosingQuestionSyncSlice(params: SyncExtraParams): SyncExtraParams {
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

export function createInterviewPerformRetakeInterviewResetSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setMessages: params.setMessages,
    setScenarioScores: params.setScenarioScores,
    setMicError: params.setMicError,
    setPreInterviewConsentAge: params.setPreInterviewConsentAge,
    setPreInterviewConsentData: params.setPreInterviewConsentData,
    setStatus: params.setStatus,
    setResults: params.setResults,
    setAnalysisAttemptId: params.setAnalysisAttemptId,
    setPendingScoringSyncAttemptId: params.setPendingScoringSyncAttemptId,
    setInterviewLastCommittedAttemptId: params.setInterviewLastCommittedAttemptId,
    setInterviewStatus: params.setInterviewStatus,
  };
}

export function createInterviewPerformRetakePostInterviewSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setShowPostInterviewFeedback: params.setShowPostInterviewFeedback,
    setPostInterviewRatings: params.setPostInterviewRatings,
    setPostInterviewComments: params.setPostInterviewComments,
    setPostInterviewGeneralFeedback: params.setPostInterviewGeneralFeedback,
    setHasSubmittedPostInterviewFeedback: params.setHasSubmittedPostInterviewFeedback,
  };
}
