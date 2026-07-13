import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type InterruptDocumentHiddenTtsSyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterruptDocumentHiddenTtsSyncExtra(
  params: InterruptDocumentHiddenTtsSyncExtraParams,
): InterruptDocumentHiddenTtsSyncExtraParams {
  return params;
}

export type InterviewDocumentVisibilityTtsSyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewDocumentVisibilityTtsSyncExtra(
  params: InterviewDocumentVisibilityTtsSyncExtraParams,
): InterviewDocumentVisibilityTtsSyncExtraParams {
  return params;
}

export type TabRestoreWatchdogSyncExtraParams = AriaInterviewDepsSyncContext;

export function createTabRestoreWatchdogSyncExtra(
  params: TabRestoreWatchdogSyncExtraParams,
): TabRestoreWatchdogSyncExtraParams {
  return params;
}
