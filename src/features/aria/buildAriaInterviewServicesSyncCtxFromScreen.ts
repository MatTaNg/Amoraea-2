import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { createAriaInterviewServicesSyncCtx } from '@features/aria/createAriaInterviewServicesSyncCtx';
import {
  buildAriaInterviewServicesSyncCtx,
  type AriaInterviewServicesSyncScope,
} from '@features/aria/buildAriaInterviewServicesSyncCtx';
import type { AriaInterviewServicesScreenRefsParams } from '@features/aria/buildAriaInterviewServicesScreenScopeInput';
import { buildAriaInterviewServicesScreenScopeInput } from '@features/aria/buildAriaInterviewServicesScreenScopeInput';

export type AriaInterviewServicesScreenScopeInput = AriaInterviewServicesSyncScope;

/** Build services-base sync context from grouped screen scope fields. */
export function buildAriaInterviewServicesSyncCtxFromScreen(
  scope: AriaInterviewServicesScreenScopeInput,
): AriaInterviewDepsSyncContext {
  return createAriaInterviewServicesSyncCtx(buildAriaInterviewServicesSyncCtx(scope));
}

/** Build services-base sync context from screen refs bag (routing injected). */
export function buildAriaInterviewServicesSyncCtxFromScreenRefs(
  params: AriaInterviewServicesScreenRefsParams,
): AriaInterviewDepsSyncContext {
  return buildAriaInterviewServicesSyncCtxFromScreen(buildAriaInterviewServicesScreenScopeInput(params));
}
