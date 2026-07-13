import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewSyncCtx } from '@features/aria/syncAriaInterviewDepsRefs';
import { createAriaInterviewWebRuntimeSyncCtx } from '@features/aria/createAriaInterviewWebRuntimeSyncCtx';
import { buildAriaInterviewWebRuntimeSyncCtx } from '@features/aria/buildAriaInterviewWebRuntimeSyncCtx';
import type { InterviewWebRuntimeLocalScope } from '@features/aria/buildInterviewWebRuntimeLocalSyncExtra';
import { buildInterviewWebRuntimeLocalSyncExtra } from '@features/aria/buildInterviewWebRuntimeLocalSyncExtra';
import { createInterviewWebRuntimeSyncExtra } from '@features/aria/createInterviewMiscSyncExtras';
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

export function buildAriaInterviewWebRuntimeMergedSyncCtx(
  servicesGateCtx: AriaInterviewDepsSyncContext,
  localScope: InterviewWebRuntimeLocalScope,
): AriaInterviewDepsSyncContext {
  return createAriaInterviewWebRuntimeSyncCtx(
    buildAriaInterviewWebRuntimeSyncCtx(
      mergeAriaInterviewSyncCtx(
        servicesGateCtx,
        createInterviewWebRuntimeSyncExtra(buildInterviewWebRuntimeLocalSyncExtra(localScope)),
      ),
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
  webRuntimeCtx: AriaInterviewDepsSyncContext,
  servicesGateCtx: AriaInterviewDepsSyncContext,
  localScope: InterviewMicClusterLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewSyncCtx(
    mergeAriaInterviewMicClusterBaseSyncCtx(coreCtx, webRuntimeCtx, servicesGateCtx),
    buildInterviewMicClusterLocalSyncExtra(localScope),
  );
}
