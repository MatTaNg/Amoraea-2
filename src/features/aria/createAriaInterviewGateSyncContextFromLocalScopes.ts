import { createAriaInterviewGateSyncCtx } from '@features/aria/createAriaInterviewGateSyncCtx';
import { buildAriaInterviewGateSyncCtx } from '@features/aria/buildAriaInterviewGateSyncCtx';
import {
  buildAriaInterviewGateLocalSyncScope,
  type AriaInterviewGateLocalSyncScope,
} from '@features/aria/buildAriaInterviewGateLocalSyncScope';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

/** Build the full gate sync context from grouped local scopes. */
export function createAriaInterviewGateSyncContextFromLocalScopes(
  scope: AriaInterviewGateLocalSyncScope,
): AriaInterviewDepsSyncContext {
  return createAriaInterviewGateSyncCtx(
    buildAriaInterviewGateSyncCtx(buildAriaInterviewGateLocalSyncScope(scope)),
  );
}
