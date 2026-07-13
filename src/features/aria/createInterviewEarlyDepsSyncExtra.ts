import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type InterviewEarlyDepsSyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewEarlyDepsSyncExtra(
  params: InterviewEarlyDepsSyncExtraParams,
): InterviewEarlyDepsSyncExtraParams {
  return params;
}
