import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewSyncCtx } from '@features/aria/syncAriaInterviewDepsRefs';
import { buildAriaInterviewRuntimeSyncCtx } from '@features/aria/buildAriaInterviewRuntimeSyncCtx';
import type { InterviewRuntimeLocalScope } from '@features/aria/buildInterviewRuntimeLocalSyncExtra';
import { buildInterviewRuntimeLocalSyncExtra } from '@features/aria/buildInterviewRuntimeLocalSyncExtra';
import { createInterviewRuntimeSyncExtra } from '@features/aria/createInterviewMiscSyncExtras';
import type { InterviewEarlyDepsLocalScope } from '@features/aria/buildInterviewEarlyDepsLocalSyncExtra';
import { buildInterviewEarlyDepsLocalSyncExtra } from '@features/aria/buildInterviewEarlyDepsLocalSyncExtra';
import { createInterviewEarlyDepsSyncExtra } from '@features/aria/createInterviewEarlyDepsSyncExtra';
import { buildInterviewEarlyDepsSyncExtra } from '@features/aria/buildInterviewEarlyDepsSyncExtra';
import type { InterviewCoreLocalScope } from '@features/aria/buildInterviewCoreLocalSyncExtra';
import { buildInterviewCoreLocalSyncExtra } from '@features/aria/buildInterviewCoreLocalSyncExtra';
import { createInterviewCoreSyncExtra } from '@features/aria/createInterviewCoreSyncExtra';
import { buildInterviewCoreSyncExtra } from '@features/aria/buildInterviewCoreSyncExtra';
import type { InterviewMicClusterLocalScope } from '@features/aria/buildInterviewMicClusterLocalSyncExtra';
import { buildInterviewMicClusterLocalSyncExtra } from '@features/aria/buildInterviewMicClusterLocalSyncExtra';
import { mergeAriaInterviewMicClusterBaseSyncCtx } from '@features/aria/buildInterviewGateSyncExtras';
import { mergeAriaInterviewCoreWithLocalSyncCtx } from '@features/aria/mergeAriaInterviewSyncContextHelpers';

export function buildAriaInterviewRuntimeMergedSyncCtx(
  servicesGateCtx: AriaInterviewDepsSyncContext,
  localScope: InterviewRuntimeLocalScope,
): AriaInterviewDepsSyncContext {
  return buildAriaInterviewRuntimeSyncCtx(
    mergeAriaInterviewSyncCtx(
      servicesGateCtx,
      createInterviewRuntimeSyncExtra(buildInterviewRuntimeLocalSyncExtra(localScope)),
    ),
  );
}

export function buildInterviewEarlyDepsMergedSyncCtx(
  runtimeGateCtx: AriaInterviewDepsSyncContext,
  localScope: InterviewEarlyDepsLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(
    runtimeGateCtx,
    createInterviewEarlyDepsSyncExtra(
      buildInterviewEarlyDepsSyncExtra(buildInterviewEarlyDepsLocalSyncExtra(localScope)),
    ),
  );
}

export function buildInterviewCoreMergedSyncCtx(
  runtimeGateCtx: AriaInterviewDepsSyncContext,
  localScope: InterviewCoreLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(
    runtimeGateCtx,
    createInterviewCoreSyncExtra(
      buildInterviewCoreSyncExtra(buildInterviewCoreLocalSyncExtra(localScope)),
    ),
  );
}

export function buildInterviewMicClusterMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  runtimeCtx: AriaInterviewDepsSyncContext,
  servicesGateCtx: AriaInterviewDepsSyncContext,
  localScope: InterviewMicClusterLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewSyncCtx(
    mergeAriaInterviewMicClusterBaseSyncCtx(coreCtx, runtimeCtx, servicesGateCtx),
    buildInterviewMicClusterLocalSyncExtra(localScope),
  );
}
