import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type InterviewTurnHandlerSyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewTurnHandlerSyncExtra(
  params: InterviewTurnHandlerSyncExtraParams,
): InterviewTurnHandlerSyncExtraParams {
  return params;
}
