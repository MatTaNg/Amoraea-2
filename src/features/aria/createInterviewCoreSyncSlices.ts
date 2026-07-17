import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewCoreSpeechControlSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    speakTextSafe: params.speakTextSafe,
  };
}

export function createInterviewCoreScenarioStateSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    currentScenarioRef: params.currentScenarioRef,
    currentInterviewMomentRef: params.currentInterviewMomentRef,
    interviewMomentsCompleteRef: params.interviewMomentsCompleteRef,
  };
}

export function createInterviewCoreSessionProgressSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    currentMessagesRef: params.currentMessagesRef,
    isInterviewCompleteRef: params.isInterviewCompleteRef,
    pendingCompletionTranscriptRef: params.pendingCompletionTranscriptRef,
    probeLogRef: params.probeLogRef,
  };
}

export function createInterviewCoreNameCaptureSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    interviewNameRef: params.interviewNameRef,
    interviewNameReaskPendingRef: params.interviewNameReaskPendingRef,
  };
}

export function createInterviewCoreMessageSettersSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setMessages: params.setMessages,
    setEmotionModalVisible: params.setEmotionModalVisible,
    setScenarioScores: params.setScenarioScores,
  };
}

export function createInterviewCoreScoreRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    scoredScenariosRef: params.scoredScenariosRef,
    scenarioScoresRef: params.scenarioScoresRef,
    resumeActiveScenarioRef: params.resumeActiveScenarioRef,
    emotionItemResponsesRef: params.emotionItemResponsesRef,
  };
}
