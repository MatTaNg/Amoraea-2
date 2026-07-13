import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewSyncCtx } from '@features/aria/syncAriaInterviewDepsRefs';
import type { AriaInterviewDiagnosticLocalScope } from '@features/aria/buildAriaInterviewDiagnosticSyncExtra';
import { buildAriaInterviewDiagnosticLocalSyncExtra } from '@features/aria/buildAriaInterviewDiagnosticSyncExtra';
import type { AriaInterviewServicesExtendedLocalScope } from '@features/aria/buildInterviewBootSyncExtras';
import { buildAriaInterviewServicesExtendedLocalSyncExtra } from '@features/aria/buildInterviewBootSyncExtras';
import type { ProfileNameSourceDebugLocalScope } from '@features/aria/buildProfileNameSourceDebugSyncExtra';
import { buildProfileNameSourceDebugLocalSyncExtra } from '@features/aria/buildProfileNameSourceDebugSyncExtra';
import { mergeAriaInterviewServicesBaseWithLocalSyncCtx } from '@features/aria/mergeAriaInterviewSyncContextHelpers';

export function buildAriaInterviewDiagnosticMergedSyncCtx(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
  localScope: AriaInterviewDiagnosticLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewServicesBaseWithLocalSyncCtx(
    servicesBaseCtx,
    buildAriaInterviewDiagnosticLocalSyncExtra(localScope),
  );
}

export function buildAriaInterviewServicesExtendedMergedSyncCtx(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
  localScope: AriaInterviewServicesExtendedLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewSyncCtx(
    servicesBaseCtx,
    buildAriaInterviewServicesExtendedLocalSyncExtra(localScope),
  );
}

export function buildProfileNameSourceDebugMergedSyncCtx(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
  localScope: ProfileNameSourceDebugLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewServicesBaseWithLocalSyncCtx(
    servicesBaseCtx,
    buildProfileNameSourceDebugLocalSyncExtra(localScope),
  );
}
