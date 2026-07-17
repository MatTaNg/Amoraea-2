import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export type InterviewTurnHandlerLocalScope = {
  statusSetters: Pick<
    SyncExtraParams,
    | 'status'
    | 'setInterviewStatus'
    | 'setPendingCompletion'
    | 'setIsWaiting'
    | 'setPendingScoringSyncAttemptId'
  >;
  emotionModal: Pick<
    SyncExtraParams,
    | 'awaitEmotionModalForIndex'
    | 'listUnansweredEmotionModalIndices'
    | 'runEmotionModalAfterScenarioTransition'
  >;
  webTtsResume: Pick<
    SyncExtraParams,
    | 'clearStaleInterviewTtsRuntimeLocks'
    | 'applyInterviewSpeechComplete'
  >;
  scenarioScoring: Pick<
    SyncExtraParams,
    | 'kickCompletionScoring'
    | 'saveScenarioCheckpoint'
    | 'fetchStageScore'
    | 'scoreScenario'
    | 'notifyScenarioStarted'
    | 'ensureCompletedScenarioScored'
    | 'scoreScenarioRef'
  >;
  uiStage: Pick<
    SyncExtraParams,
    | 'setReferenceCardPrompt'
    | 'setHighestScenarioReached'
    | 'setStageResults'
    | 'kickPostClosingInterviewCompletionIfReady'
  >;
  closingQuestion: Pick<
    SyncExtraParams,
    | 'setClosingQuestionPending'
    | 'setClosingQuestionScenario'
    | 'markClosingQuestionAsked'
    | 'markClosingQuestionAnswered'
    | 'closingQuestionPending'
    | 'closingQuestionScenario'
  >;
  persistence: Pick<
    SyncExtraParams,
    | 'commitInterviewMessages'
    | 'saveInterviewToStorage'
    | 'persistInterviewAttemptSessionLifecycle'
    | 'applyInterviewProgressFromAssistantText'
    | 'insertPreambleBriefingIfMissing'
    | 'resolveAssistantScenarioNumber'
  >;
  transcript: Pick<
    SyncExtraParams,
    'setCurrentTranscript' | 'setExchangeCount' | 'showChatError' | 'usedPersonalExamples'
  >;
  sessionBootstrap: Pick<
    SyncExtraParams,
    | 'createInterviewAttemptOnFirstSubstantiveResponse'
    | 'collectDeviceContext'
    | 'assignAttemptIdForSessionLogs'
    | 'markAiProcessingTurnStarted'
  >;
};

export function buildInterviewTurnHandlerLocalSyncExtra(
  scope: InterviewTurnHandlerLocalScope,
): SyncExtraParams {
  return {
    ...scope.statusSetters,
    ...scope.emotionModal,
    ...scope.webTtsResume,
    ...scope.scenarioScoring,
    ...scope.uiStage,
    ...scope.closingQuestion,
    ...scope.persistence,
    ...scope.transcript,
    ...scope.sessionBootstrap,
  };
}
