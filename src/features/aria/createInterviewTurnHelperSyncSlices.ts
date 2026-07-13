import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createResetScenarioCClientGatesSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    scenarioCRepairOnlyEvidenceRef: params.scenarioCRepairOnlyEvidenceRef,
    scenarioCSophiePerspectiveProbeFiredRef: params.scenarioCSophiePerspectiveProbeFiredRef,
  };
}

export function createResolveAssistantScenarioNumberSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    currentInterviewMomentRef: params.currentInterviewMomentRef,
    currentScenarioRef: params.currentScenarioRef,
    detectScenarioFromResponse: params.detectScenarioFromResponse,
    isScenarioCQ1Prompt: params.isScenarioCQ1Prompt,
    getScenarioNumberForNewMessage: params.getScenarioNumberForNewMessage,
  };
}

export function createProcessTurnAudioSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userId: params.userId,
    interviewSessionIdRef: params.interviewSessionIdRef,
    supabaseAnonKey: params.supabaseAnonKey,
    getResolvedSupabaseUrl: params.getResolvedSupabaseUrl,
    bytesToBase64: params.bytesToBase64,
    deleteTurnAudioFile: params.deleteTurnAudioFile,
  };
}
