import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { buildAriaInterviewGateSyncCtxFromScreenRefsBag } from '@features/aria/buildAriaInterviewGateScreenScopeInputFromRefs';
import type { AriaInterviewGateScreenRefsParams } from '@features/aria/buildAriaInterviewGateScreenRefsInput';

/** Recompute gate dep-sync context each render from live refs (must not memoize). */
export function useAriaInterviewGateSyncContext(
  params: AriaInterviewGateScreenRefsParams,
): AriaInterviewDepsSyncContext {
  return buildAriaInterviewGateSyncCtxFromScreenRefsBag(params);
}
