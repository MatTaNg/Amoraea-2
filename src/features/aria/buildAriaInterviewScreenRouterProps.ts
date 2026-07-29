import type { AriaInterviewScreenRouterProps } from '@features/aria/screens/AriaInterviewScreenRouter';

export type AriaInterviewScreenRouterScope = {
  routing: Pick<
    AriaInterviewScreenRouterProps,
    | 'sessionExpired'
    | 'interviewStatus'
    | 'status'
    | 'fromValidationTrack'
    | 'pendingCompletion'
    | 'resumeLoadingVisible'
    | 'resumeHydrationPending'
  >;
  adminAccess: Pick<
    AriaInterviewScreenRouterProps,
    | 'shouldShowAdminPanel'
    | 'alphaMode'
    | 'analysisAttemptId'
    | 'isAdmin'
    | 'isAdminAccount'
    | 'userId'
    | 'adminInterviewTopBar'
  >;
  postInterviewFeedback: Pick<
    AriaInterviewScreenRouterProps,
    | 'hasSubmittedPostInterviewFeedback'
    | 'showPostInterviewFeedback'
    | 'postInterviewFeedbackError'
    | 'postInterviewRatings'
    | 'postInterviewComments'
    | 'postInterviewGeneralFeedback'
    | 'setPostInterviewFeedbackError'
    | 'setShowPostInterviewFeedback'
    | 'setPostInterviewRatings'
    | 'setPostInterviewComments'
    | 'setPostInterviewGeneralFeedback'
    | 'handleSubmitPostInterviewFeedback'
    | 'handleBackToValidationReport'
  >;
  startConsent: Pick<
    AriaInterviewScreenRouterProps,
    | 'micError'
    | 'micPermission'
    | 'micWarning'
    | 'preInterviewConsentAge'
    | 'preInterviewConsentData'
    | 'interviewStartInFlight'
    | 'interviewAttemptBootstrap'
    | 'onboardingAutoStartRef'
    | 'setMicError'
    | 'setPreInterviewConsentAge'
    | 'setPreInterviewConsentData'
    | 'startInterview'
  >;
  sessionAuth: Pick<
    AriaInterviewScreenRouterProps,
    'supabase' | 'signOut' | 'setSessionExpired' | 'setShowAdminPanel' | 'handleInterviewSignOut' | 'handleRetake'
  >;
};

/** Merge grouped router props into the flat shape expected by AriaInterviewScreenRouter. */
export function buildAriaInterviewScreenRouterProps(
  scope: AriaInterviewScreenRouterScope,
): AriaInterviewScreenRouterProps {
  return {
    ...scope.routing,
    ...scope.adminAccess,
    ...scope.postInterviewFeedback,
    ...scope.startConsent,
    ...scope.sessionAuth,
  };
}
