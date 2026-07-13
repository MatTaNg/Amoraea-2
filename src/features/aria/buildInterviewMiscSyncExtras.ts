import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createApplyInterviewSpeechCompleteSyncSlice,
  createAriaScreenMountedLogSyncSlice,
  createInterviewScrollToEndSyncSlice,
  createNavigateBackToValidationReportSyncSlice,
  createOpenAdminPanelFromRouteSyncSlice,
  createPostInterviewFeedbackAlertSyncSlice,
  createShowChatErrorSyncSlice,
} from '@features/aria/createInterviewMiscSyncSlices';

export function buildNavigateBackToValidationReportSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createNavigateBackToValidationReportSyncSlice(params);
}

export function buildOpenAdminPanelFromRouteSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createOpenAdminPanelFromRouteSyncSlice(params);
}

export function buildAriaScreenMountedLogSyncExtra(params: AriaInterviewDepsSyncContext): AriaInterviewDepsSyncContext {
  return createAriaScreenMountedLogSyncSlice(params);
}

export function buildInterviewScrollToEndSyncExtra(params: AriaInterviewDepsSyncContext): AriaInterviewDepsSyncContext {
  return createInterviewScrollToEndSyncSlice(params);
}

export function buildShowChatErrorSyncExtra(params: AriaInterviewDepsSyncContext): AriaInterviewDepsSyncContext {
  return createShowChatErrorSyncSlice(params);
}

export function buildApplyInterviewSpeechCompleteSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createApplyInterviewSpeechCompleteSyncSlice(params);
}

export function buildPostInterviewFeedbackAlertSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createPostInterviewFeedbackAlertSyncSlice(params);
}
