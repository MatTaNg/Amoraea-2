import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type InterviewCoreSyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewCoreSyncExtra(
  params: InterviewCoreSyncExtraParams,
): InterviewCoreSyncExtraParams {
  return params;
}
