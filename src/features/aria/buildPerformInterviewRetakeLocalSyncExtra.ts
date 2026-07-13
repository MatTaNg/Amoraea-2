import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import type { AriaPostInterviewFeedbackState } from '@features/aria/hooks/useAriaPostInterviewFeedbackState';
import {
  toAriaInterviewGateClosingQuestionRefsScope,
  toPerformInterviewClosingQuestionSettersScope,
  type AriaInterviewClosingQuestionState,
} from '@features/aria/hooks/useAriaInterviewClosingQuestionState';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export type PerformInterviewRetakeLocalScope = {
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
  interviewReset: Pick<
    SyncExtraParams,
    | 'currentInterviewMomentRef'
    | 'onboardingAutoStartRef'
    | 'responseTimingsRef'
    | 'setMicError'
    | 'setPreInterviewConsentAge'
    | 'setPreInterviewConsentData'
    | 'setStatus'
    | 'setResults'
    | 'setAnalysisAttemptId'
    | 'setPendingScoringSyncAttemptId'
    | 'setInterviewLastCommittedAttemptId'
    | 'setInterviewStatus'
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

export function buildPerformInterviewRetakeLocalSyncExtra(
  scope: PerformInterviewRetakeLocalScope,
): SyncExtraParams {
  return {
    ...toAriaInterviewGateClosingQuestionRefsScope(scope.closingQuestion),
    ...toPerformInterviewClosingQuestionSettersScope(scope.closingQuestion),
    ...scope.interviewReset,
    setShowPostInterviewFeedback: scope.postInterviewReset.setShowPostInterviewFeedback,
    setPostInterviewRatings: scope.postInterviewReset.setPostInterviewRatings,
    setPostInterviewComments: scope.postInterviewReset.setPostInterviewComments,
    setPostInterviewGeneralFeedback: scope.postInterviewReset.setPostInterviewGeneralFeedback,
    setHasSubmittedPostInterviewFeedback: scope.postInterviewReset.setHasSubmittedPostInterviewFeedback,
  };
}
