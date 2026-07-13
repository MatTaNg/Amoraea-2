import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewServicesIdentitySyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    hasAnthropicConfigured: params.hasAnthropicConfigured,
    userId: params.userId,
    isAdmin: params.isAdmin,
    supabase: params.supabase,
    navigation: params.navigation,
    isAmoraeaAdminConsoleEmail: params.isAmoraeaAdminConsoleEmail,
    remoteLog: params.remoteLog,
  };
}

export function createInterviewServicesSessionRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    statusRef: params.statusRef,
    interviewStatusRef: params.interviewStatusRef,
    isInterviewCompleteRef: params.isInterviewCompleteRef,
    interviewSessionAttemptIdRef: params.interviewSessionAttemptIdRef,
    interviewSessionIdRef: params.interviewSessionIdRef,
    currentMessagesRef: params.currentMessagesRef,
    scoredScenariosRef: params.scoredScenariosRef,
    scenarioScoresRef: params.scenarioScoresRef,
    resumeActiveScenarioRef: params.resumeActiveScenarioRef,
    emotionItemResponsesRef: params.emotionItemResponsesRef,
    committedScenarioRef: params.committedScenarioRef,
    moment5PrimaryAnchorDeliveredSessionRef: params.moment5PrimaryAnchorDeliveredSessionRef,
    responseTimingsRef: params.responseTimingsRef,
  };
}

export function createInterviewServicesLiveStateSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    messages: params.messages,
    scenarioScores: params.scenarioScores,
  };
}

export function createInterviewServicesRoutingSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userInterviewRoutingTable: params.userInterviewRoutingTable,
    userInterviewPassSelect: params.userInterviewPassSelect,
  };
}

export function createInterviewServicesStoragePipelineSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    resolveInterviewCompletedForUser: params.resolveInterviewCompletedForUser,
    takeInterviewJustCompletedInSession: params.takeInterviewJustCompletedInSession,
    takeInterviewLastCommittedAttemptId: params.takeInterviewLastCommittedAttemptId,
    hasPreparingResultsSession: params.hasPreparingResultsSession,
    markPreparingResultsSession: params.markPreparingResultsSession,
    clearPreparingResultsSession: params.clearPreparingResultsSession,
    waitForInterviewAttemptScoringReady: params.waitForInterviewAttemptScoringReady,
    clearInterviewFromStorage: params.clearInterviewFromStorage,
    loadInterviewFromStorage: params.loadInterviewFromStorage,
    saveInterviewProgress: params.saveInterviewProgress,
    replaceWithStandardApplicantPostInterviewHandoffForUser:
      params.replaceWithStandardApplicantPostInterviewHandoffForUser,
    runCommunicationStylePipelineAfterSave: params.runCommunicationStylePipelineAfterSave,
    getSessionLogRuntime: params.getSessionLogRuntime,
    resolveStandardPostInterviewHandoffEligible: params.resolveStandardPostInterviewHandoffEligible,
    isValidationTrackInterviewHandoffActive: params.isValidationTrackInterviewHandoffActive,
    syncLiveInterviewTranscriptToAttempt: params.syncLiveInterviewTranscriptToAttempt,
  };
}

export function createInterviewServicesBootstrapSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setInterviewAttemptBootstrap: params.setInterviewAttemptBootstrap,
    resetSessionLogRuntime: params.resetSessionLogRuntime,
    markSessionResumedForNextRecordingStart: params.markSessionResumedForNextRecordingStart,
    syncWebAudioRouteSessionEnvelopeFromCache: params.syncWebAudioRouteSessionEnvelopeFromCache,
  };
}

export function createInterviewServicesUiSettersSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setSessionExpired: params.setSessionExpired,
    setInterviewStatus: params.setInterviewStatus,
    setAnalysisAttemptId: params.setAnalysisAttemptId,
    setPendingScoringSyncAttemptId: params.setPendingScoringSyncAttemptId,
    setStandardResultsReferralCode: params.setStandardResultsReferralCode,
    setInterviewUiPhase: params.setInterviewUiPhase,
    setReferenceCardPrompt: params.setReferenceCardPrompt,
    setReferenceCardScenario: params.setReferenceCardScenario,
  };
}

export function createInterviewServicesTranscriptHelpersSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    isAssistantBubbleForTranscript: params.isAssistantBubbleForTranscript,
    stripControlTokens: params.stripControlTokens,
    detectActiveScenarioFromMessage: params.detectActiveScenarioFromMessage,
  };
}
