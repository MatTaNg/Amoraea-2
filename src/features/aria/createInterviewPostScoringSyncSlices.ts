import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createRestorePreparingResultsInterviewStatusSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userId: params.userId,
    isAdmin: params.isAdmin,
    hasPreparingResultsSession: params.hasPreparingResultsSession,
    isInterviewCompleteRef: params.isInterviewCompleteRef,
    interviewStatusRef: params.interviewStatusRef,
    setInterviewStatus: params.setInterviewStatus,
  };
}

export function createCheckInterviewStatusSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    supabase: params.supabase,
    navigation: params.navigation,
    interviewStatusRef: params.interviewStatusRef,
    isInterviewCompleteRef: params.isInterviewCompleteRef,
    statusRef: params.statusRef,
    interviewSessionIdRef: params.interviewSessionIdRef,
    userInterviewRoutingTable: params.userInterviewRoutingTable,
    userInterviewPassSelect: params.userInterviewPassSelect,
    isAmoraeaAdminConsoleEmail: params.isAmoraeaAdminConsoleEmail,
    resolveInterviewCompletedForUser: params.resolveInterviewCompletedForUser,
    takeInterviewJustCompletedInSession: params.takeInterviewJustCompletedInSession,
    takeInterviewLastCommittedAttemptId: params.takeInterviewLastCommittedAttemptId,
    hasPreparingResultsSession: params.hasPreparingResultsSession,
    markPreparingResultsSession: params.markPreparingResultsSession,
    clearPreparingResultsSession: params.clearPreparingResultsSession,
    waitForInterviewAttemptScoringReady: params.waitForInterviewAttemptScoringReady,
    clearInterviewFromStorage: params.clearInterviewFromStorage,
    replaceWithStandardApplicantPostInterviewHandoffForUser:
      params.replaceWithStandardApplicantPostInterviewHandoffForUser,
    setInterviewStatus: params.setInterviewStatus,
    setAnalysisAttemptId: params.setAnalysisAttemptId,
    setPendingScoringSyncAttemptId: params.setPendingScoringSyncAttemptId,
    remoteLog: params.remoteLog,
  };
}

export function createPendingScoringSyncPollSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    supabase: params.supabase,
    navigation: params.navigation,
    interviewSessionIdRef: params.interviewSessionIdRef,
    waitForInterviewAttemptScoringReady: params.waitForInterviewAttemptScoringReady,
    setPendingScoringSyncAttemptId: params.setPendingScoringSyncAttemptId,
    setAnalysisAttemptId: params.setAnalysisAttemptId,
    clearPreparingResultsSession: params.clearPreparingResultsSession,
    runCommunicationStylePipelineAfterSave: params.runCommunicationStylePipelineAfterSave,
    getSessionLogRuntime: params.getSessionLogRuntime,
    resolveStandardPostInterviewHandoffEligible: params.resolveStandardPostInterviewHandoffEligible,
    isValidationTrackInterviewHandoffActive: params.isValidationTrackInterviewHandoffActive,
    clearInterviewFromStorage: params.clearInterviewFromStorage,
    replaceWithStandardApplicantPostInterviewHandoffForUser:
      params.replaceWithStandardApplicantPostInterviewHandoffForUser,
    setInterviewStatus: params.setInterviewStatus,
    remoteLog: params.remoteLog,
  };
}

export function createInterviewLoadingStatusFailsafeSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userId: params.userId,
    isAdmin: params.isAdmin,
    supabase: params.supabase,
    interviewStatusRef: params.interviewStatusRef,
    userInterviewRoutingTable: params.userInterviewRoutingTable,
    setInterviewStatus: params.setInterviewStatus,
  };
}

export function createAlphaModeCongratulationsFailsafeSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    clearPreparingResultsSession: params.clearPreparingResultsSession,
    setInterviewStatus: params.setInterviewStatus,
  };
}

export function createLoadStandardResultsReferralCodeSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    supabase: params.supabase,
    isAmoraeaAdminConsoleEmail: params.isAmoraeaAdminConsoleEmail,
    setStandardResultsReferralCode: params.setStandardResultsReferralCode,
  };
}

export function createRecoverPendingDatabaseSaveSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    supabase: params.supabase,
    interviewSessionIdRef: params.interviewSessionIdRef,
    loadInterviewFromStorage: params.loadInterviewFromStorage,
    saveInterviewProgress: params.saveInterviewProgress,
    ensureValidSession: params.ensureValidSession,
    runCommunicationStylePipelineAfterSave: params.runCommunicationStylePipelineAfterSave,
    getSessionLogRuntime: params.getSessionLogRuntime,
  };
}
