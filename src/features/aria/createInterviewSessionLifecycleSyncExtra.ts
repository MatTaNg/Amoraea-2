import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type InterviewSessionLifecycleSyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewSessionLifecycleSyncExtra(
  params: InterviewSessionLifecycleSyncExtraParams,
): InterviewSessionLifecycleSyncExtraParams {
  return params;
}
