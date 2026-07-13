import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type InterviewTtsPipelineSyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewTtsPipelineSyncExtra(
  params: InterviewTtsPipelineSyncExtraParams,
): InterviewTtsPipelineSyncExtraParams {
  return params;
}
