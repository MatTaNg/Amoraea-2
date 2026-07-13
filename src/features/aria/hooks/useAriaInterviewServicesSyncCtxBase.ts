import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import type { AriaInterviewServicesScreenRefsParams } from '@features/aria/buildAriaInterviewServicesScreenScopeInput';
import { buildAriaInterviewServicesSyncCtxFromScreenRefs } from '@features/aria/buildAriaInterviewServicesSyncCtxFromScreen';

/** Recompute services-base dep-sync context each render from live refs (must not memoize). */
export function useAriaInterviewServicesSyncCtxBase(
  params: AriaInterviewServicesScreenRefsParams,
): AriaInterviewDepsSyncContext {
  return buildAriaInterviewServicesSyncCtxFromScreenRefs(params);
}
