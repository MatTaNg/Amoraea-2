import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewDeliverRecordingRetryLineRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    lastRecordingRetryDeliveredNormRef: params.lastRecordingRetryDeliveredNormRef,
    lastRecordingRetryDeliveredAtMsRef: params.lastRecordingRetryDeliveredAtMsRef,
    lastSuccessfulTtsTextNormalizedRef: params.lastSuccessfulTtsTextNormalizedRef,
    currentScenarioRef: params.currentScenarioRef,
    currentInterviewMomentRef: params.currentInterviewMomentRef,
  };
}

export function createInterviewDeliverRecordingRetryLineActionsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setVoiceState: params.setVoiceState,
    speakTextSafe: params.speakTextSafe,
    commitInterviewMessages: params.commitInterviewMessages,
  };
}
