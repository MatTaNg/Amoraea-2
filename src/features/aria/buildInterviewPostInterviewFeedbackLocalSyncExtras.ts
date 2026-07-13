import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import type { AriaPostInterviewFeedbackState } from '@features/aria/hooks/useAriaPostInterviewFeedbackState';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export type InterviewCompletionScoringLocalScope = {
  identity: Pick<
    SyncExtraParams,
    'typologyContext' | 'routeName' | 'userEmail' | 'profile' | 'fromValidationTrack' | 'navigation' | 'queryClient'
  >;
  actions: Pick<
    SyncExtraParams,
    | 'ensureValidSession'
    | 'scoreScenario'
    | 'setResults'
    | 'setStageResults'
    | 'setInterviewStatus'
    | 'setStatus'
    | 'setPendingScoringSyncAttemptId'
    | 'loadEmotionResponsesForCompletion'
    | 'applyEmotionResponsesToSession'
    | 'markCompletionScoringInFlight'
    | 'replaceWithStandardApplicantPostInterviewHandoffForUser'
    | 'setInterviewLastCommittedAttemptId'
  >;
};

export function buildInterviewCompletionScoringLocalSyncExtra(
  scope: InterviewCompletionScoringLocalScope,
): SyncExtraParams {
  return {
    ...scope.identity,
    ...scope.actions,
  };
}

export type SubmitPostInterviewFeedbackLocalScope = {
  feedbackState: Pick<
    AriaPostInterviewFeedbackState,
    | 'hasSubmittedPostInterviewFeedback'
    | 'postInterviewRatings'
    | 'postInterviewComments'
    | 'postInterviewGeneralFeedback'
  >;
  feedbackSetters: Pick<
    AriaPostInterviewFeedbackState,
    | 'setPostInterviewFeedbackError'
    | 'setHasSubmittedPostInterviewFeedback'
    | 'setShowPostInterviewFeedback'
  >;
  handlers: Pick<SyncExtraParams, 'showFeedbackNotice' | 'showMissingAttemptAlert'>;
  analysisAttemptId: string | null;
};

export function buildSubmitPostInterviewFeedbackLocalSyncExtra(
  scope: SubmitPostInterviewFeedbackLocalScope,
): SyncExtraParams {
  return {
    hasSubmittedPostInterviewFeedback: scope.feedbackState.hasSubmittedPostInterviewFeedback,
    postInterviewRatings: scope.feedbackState.postInterviewRatings,
    postInterviewComments: scope.feedbackState.postInterviewComments,
    postInterviewGeneralFeedback: scope.feedbackState.postInterviewGeneralFeedback,
    analysisAttemptId: scope.analysisAttemptId,
    setPostInterviewFeedbackError: scope.feedbackSetters.setPostInterviewFeedbackError,
    setHasSubmittedPostInterviewFeedback: scope.feedbackSetters.setHasSubmittedPostInterviewFeedback,
    setShowPostInterviewFeedback: scope.feedbackSetters.setShowPostInterviewFeedback,
    showFeedbackNotice: scope.handlers.showFeedbackNotice,
    showMissingAttemptAlert: scope.handlers.showMissingAttemptAlert,
  };
}

export type LoadPostInterviewFeedbackLocalScope = {
  interviewStatus: string;
  analysisAttemptId: string | null;
  feedbackSetters: Pick<
    AriaPostInterviewFeedbackState,
    | 'setPostInterviewRatings'
    | 'setPostInterviewComments'
    | 'setPostInterviewGeneralFeedback'
    | 'setHasSubmittedPostInterviewFeedback'
  >;
};

export function buildLoadPostInterviewFeedbackLocalSyncExtra(
  scope: LoadPostInterviewFeedbackLocalScope,
): SyncExtraParams {
  return {
    interviewStatus: scope.interviewStatus,
    analysisAttemptId: scope.analysisAttemptId,
    setPostInterviewRatings: scope.feedbackSetters.setPostInterviewRatings,
    setPostInterviewComments: scope.feedbackSetters.setPostInterviewComments,
    setPostInterviewGeneralFeedback: scope.feedbackSetters.setPostInterviewGeneralFeedback,
    setHasSubmittedPostInterviewFeedback: scope.feedbackSetters.setHasSubmittedPostInterviewFeedback,
  };
}
