import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewWebGreetingPrefetchSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    hasAnthropicConfigured: params.hasAnthropicConfigured,
  };
}

export function createInterviewAttemptBootstrapSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userId: params.userId,
    isAdmin: params.isAdmin,
    supabase: params.supabase,
    interviewSessionAttemptIdRef: params.interviewSessionAttemptIdRef,
    interviewSessionIdRef: params.interviewSessionIdRef,
    clearInterviewFromStorage: params.clearInterviewFromStorage,
    loadInterviewFromStorage: params.loadInterviewFromStorage,
    setInterviewAttemptBootstrap: params.setInterviewAttemptBootstrap,
    resetSessionLogRuntime: params.resetSessionLogRuntime,
    markSessionResumedForNextRecordingStart: params.markSessionResumedForNextRecordingStart,
    syncWebAudioRouteSessionEnvelopeFromCache: params.syncWebAudioRouteSessionEnvelopeFromCache,
    responseTimingsRef: params.responseTimingsRef,
  };
}

export function createInterviewUnhandledRejectionSaveSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userId: params.userId,
    statusRef: params.statusRef,
    currentMessagesRef: params.currentMessagesRef,
    scoredScenariosRef: params.scoredScenariosRef,
    scenarioScoresRef: params.scenarioScoresRef,
    resumeActiveScenarioRef: params.resumeActiveScenarioRef,
    saveInterviewProgress: params.saveInterviewProgress,
  };
}

export function createInterviewAuthSignedOutSaveSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userId: params.userId,
    supabase: params.supabase,
    currentMessagesRef: params.currentMessagesRef,
    scoredScenariosRef: params.scoredScenariosRef,
    scenarioScoresRef: params.scenarioScoresRef,
    resumeActiveScenarioRef: params.resumeActiveScenarioRef,
    saveInterviewProgress: params.saveInterviewProgress,
    setSessionExpired: params.setSessionExpired,
  };
}

export function createEnsureValidSessionSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    supabase: params.supabase,
  };
}
