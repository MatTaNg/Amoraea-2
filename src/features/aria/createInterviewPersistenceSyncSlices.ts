import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewSaveActiveInterviewProgressSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    messages: params.messages,
    scenarioScores: params.scenarioScores,
    scoredScenariosRef: params.scoredScenariosRef,
    currentScenarioRef: params.currentScenarioRef,
    resumeActiveScenarioRef: params.resumeActiveScenarioRef,
    emotionItemResponsesRef: params.emotionItemResponsesRef,
    interviewStatusRef: params.interviewStatusRef,
    interviewSessionAttemptIdRef: params.interviewSessionAttemptIdRef,
    saveInterviewProgress: params.saveInterviewProgress,
  };
}

export function createInterviewDebouncedLiveTranscriptSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    messages: params.messages,
    interviewStatusRef: params.interviewStatusRef,
    interviewSessionAttemptIdRef: params.interviewSessionAttemptIdRef,
    resumeActiveScenarioRef: params.resumeActiveScenarioRef,
    supabase: params.supabase,
    syncLiveInterviewTranscriptToAttempt: params.syncLiveInterviewTranscriptToAttempt,
  };
}

export function createInterviewScenarioTransitionUiSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    messages: params.messages,
    committedScenarioRef: params.committedScenarioRef,
    isAssistantBubbleForTranscript: params.isAssistantBubbleForTranscript,
    stripControlTokens: params.stripControlTokens,
    detectActiveScenarioFromMessage: params.detectActiveScenarioFromMessage,
    setInterviewUiPhase: params.setInterviewUiPhase,
    setReferenceCardPrompt: params.setReferenceCardPrompt,
    setReferenceCardScenario: params.setReferenceCardScenario,
  };
}

export function createInterviewApplyReferenceCardFromAssistantSpeechSyncSlice(
  params: SyncExtraParams,
): SyncExtraParams {
  return {
    messages: params.messages,
    committedScenarioRef: params.committedScenarioRef,
    moment5PrimaryAnchorDeliveredSessionRef: params.moment5PrimaryAnchorDeliveredSessionRef,
    moment5QuestionDeliveredRef: params.moment5QuestionDeliveredRef,
    currentInterviewMomentRef: params.currentInterviewMomentRef,
    lastQuestionTextRef: params.lastQuestionTextRef,
    scenarioAContemptProbeAskedRef: params.scenarioAContemptProbeAskedRef,
    scenarioARepairQuestionAskedRef: params.scenarioARepairQuestionAskedRef,
    setReferenceCardScenario: params.setReferenceCardScenario,
    setReferenceCardPrompt: params.setReferenceCardPrompt,
    setInterviewUiPhase: params.setInterviewUiPhase,
  };
}
