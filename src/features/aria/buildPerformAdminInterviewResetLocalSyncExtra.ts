import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import type { AriaPostInterviewFeedbackState } from '@features/aria/hooks/useAriaPostInterviewFeedbackState';
import {
  toAriaInterviewGateClosingQuestionRefsScope,
  toPerformInterviewClosingQuestionSettersScope,
  type AriaInterviewClosingQuestionState,
} from '@features/aria/hooks/useAriaInterviewClosingQuestionState';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export type PerformAdminInterviewResetLocalScope = {
  media: Pick<
    SyncExtraParams,
    | 'audioRecorder'
    | 'recognitionRef'
    | 'stopElevenLabsPlayback'
    | 'stopElevenLabsSpeech'
  >;
  storage: Pick<
    SyncExtraParams,
    'clearInterviewFromStorage' | 'setInterviewJustCompletedInSession' | 'hasResumedRef'
  >;
  closingQuestion: Pick<
    AriaInterviewClosingQuestionState,
    | 'closingQuestionAskedRef'
    | 'closingQuestionAnsweredRef'
    | 'lastClosingQuestionScenarioRef'
    | 'lastAnsweredClosingScenarioRef'
    | 'waitingForClosingAdditionRef'
    | 'setClosingQuestionState'
    | 'setClosingQuestionPending'
    | 'setClosingQuestionScenario'
  >;
  sessionRefs: Pick<
    SyncExtraParams,
    | 'onboardingAutoStartRef'
    | 'timingRef'
    | 'transcriptAtReleaseRef'
    | 'waitingMessageIdRef'
    | 'isSpeakingRef'
  >;
  interviewReset: Pick<
    SyncExtraParams,
    | 'setMicError'
    | 'setMicWarning'
    | 'setResults'
    | 'setAnalysisAttemptId'
    | 'setPendingScoringSyncAttemptId'
    | 'setInterviewLastCommittedAttemptId'
    | 'setHighestScenarioReached'
    | 'setStageResults'
    | 'setTouchedConstructs'
    | 'setExchangeCount'
    | 'setIsWaiting'
    | 'setCurrentTranscript'
    | 'setTypedAnswer'
    | 'setUsedPersonalExamples'
    | 'setPendingCompletion'
    | 'setInterviewUiPhase'
    | 'setReferenceCardScenario'
    | 'setReferenceCardPrompt'
    | 'resetInterviewProgressRefs'
    | 'startInterview'
  >;
  postInterviewReset: Pick<
    AriaPostInterviewFeedbackState,
    | 'setShowPostInterviewFeedback'
    | 'setPostInterviewRatings'
    | 'setPostInterviewComments'
    | 'setPostInterviewGeneralFeedback'
    | 'setHasSubmittedPostInterviewFeedback'
  >;
};

export function buildPerformAdminInterviewResetLocalSyncExtra(
  scope: PerformAdminInterviewResetLocalScope,
): SyncExtraParams {
  return {
    ...scope.media,
    ...scope.storage,
    ...toAriaInterviewGateClosingQuestionRefsScope(scope.closingQuestion),
    ...toPerformInterviewClosingQuestionSettersScope(scope.closingQuestion),
    ...scope.sessionRefs,
    ...scope.interviewReset,
    setShowPostInterviewFeedback: scope.postInterviewReset.setShowPostInterviewFeedback,
    setPostInterviewRatings: scope.postInterviewReset.setPostInterviewRatings,
    setPostInterviewComments: scope.postInterviewReset.setPostInterviewComments,
    setPostInterviewGeneralFeedback: scope.postInterviewReset.setPostInterviewGeneralFeedback,
    setHasSubmittedPostInterviewFeedback: scope.postInterviewReset.setHasSubmittedPostInterviewFeedback,
  };
}
