import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type AriaInterviewServicesSyncCtxParams = AriaInterviewDepsSyncContext;

/** Shared boot, post-scoring, and persistence fields for AriaScreen dep sync. */
export function createAriaInterviewServicesSyncCtx(
  params: AriaInterviewServicesSyncCtxParams,
): AriaInterviewServicesSyncCtxParams {
  return params;
}
