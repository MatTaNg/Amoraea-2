import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type InterviewCompletionScoringSyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewCompletionScoringSyncExtra(
  params: InterviewCompletionScoringSyncExtraParams,
): InterviewCompletionScoringSyncExtraParams {
  return params;
}
