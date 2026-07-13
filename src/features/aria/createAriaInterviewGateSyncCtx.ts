import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type AriaInterviewGateSyncCtxParams = AriaInterviewDepsSyncContext;

/** Shared gate / progress-reset fields for AriaScreen dep sync. */
export function createAriaInterviewGateSyncCtx(
  params: AriaInterviewGateSyncCtxParams,
): AriaInterviewGateSyncCtxParams {
  return params;
}
