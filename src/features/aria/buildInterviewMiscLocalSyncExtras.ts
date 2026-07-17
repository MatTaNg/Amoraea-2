import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type NavigateBackToValidationReportLocalScope = Pick<AriaInterviewDepsSyncContext, 'navigation'>;

export function buildNavigateBackToValidationReportLocalSyncExtra(
  scope: NavigateBackToValidationReportLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}

export type OpenAdminPanelFromRouteLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  'setShowAdminPanel' | 'navigation'
>;

export function buildOpenAdminPanelFromRouteLocalSyncExtra(
  scope: OpenAdminPanelFromRouteLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}

export type InterviewScrollToEndLocalScope = Pick<AriaInterviewDepsSyncContext, 'scrollViewRef'>;

export function buildInterviewScrollToEndLocalSyncExtra(
  scope: InterviewScrollToEndLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}

export type ShowChatErrorLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  'setMessages' | 'setConversationErrorNotice'
>;

export function buildShowChatErrorLocalSyncExtra(scope: ShowChatErrorLocalScope): AriaInterviewDepsSyncContext {
  return scope;
}

export type ApplyInterviewSpeechCompleteLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'applyReferenceCardFromAssistantSpeech'
  | 'currentScenarioRef'
  | 'currentInterviewMomentRef'
  | 'interviewMomentsCompleteRef'
  | 'resumeActiveScenarioRef'
  | 'interviewSessionIdRef'
>;

export function buildApplyInterviewSpeechCompleteLocalSyncExtra(
  scope: ApplyInterviewSpeechCompleteLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}

export type PostInterviewFeedbackAlertLocalScope = Pick<AriaInterviewDepsSyncContext, 'showSimpleAlert'>;

export function buildPostInterviewFeedbackAlertLocalSyncExtra(
  scope: PostInterviewFeedbackAlertLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}
