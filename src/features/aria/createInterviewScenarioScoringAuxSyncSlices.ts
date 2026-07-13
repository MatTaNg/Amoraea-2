import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewFetchStageScoreSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    typologyContext: params.typologyContext,
  };
}

export function createInterviewSaveScenarioCheckpointSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    interviewSessionAttemptIdRef: params.interviewSessionAttemptIdRef,
    resumeActiveScenarioRef: params.resumeActiveScenarioRef,
    supabase: params.supabase,
    loadInterviewFromStorage: params.loadInterviewFromStorage,
    saveInterviewToStorage: params.saveInterviewToStorage,
  };
}
