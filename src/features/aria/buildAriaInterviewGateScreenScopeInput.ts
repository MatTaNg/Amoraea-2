import type { AriaInterviewGateScreenScopeInput } from '@features/aria/buildAriaInterviewGateSyncScopeFromScreen';
import { buildAriaInterviewGateSyncScopeFromScreen } from '@features/aria/buildAriaInterviewGateSyncScopeFromScreen';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

/** Build gate sync context from grouped screen-local scope fields (screen supplies refs/state). */
export function buildAriaInterviewGateSyncCtxFromScreenScopeInput(
  screen: AriaInterviewGateScreenScopeInput,
): AriaInterviewDepsSyncContext {
  return buildAriaInterviewGateSyncScopeFromScreen(screen);
}
