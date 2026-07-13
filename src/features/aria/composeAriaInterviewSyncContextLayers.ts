import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import type { InterviewEarlyDepsLocalScope } from '@features/aria/buildInterviewEarlyDepsLocalSyncExtra';
import type { InterviewCoreLocalScope } from '@features/aria/buildInterviewCoreLocalSyncExtra';
import type { InterviewWebRuntimeLocalScope } from '@features/aria/buildInterviewWebRuntimeLocalSyncExtra';
import {
  buildAriaInterviewWebRuntimeMergedSyncCtx,
  buildInterviewCoreMergedSyncCtx,
  buildInterviewEarlyDepsMergedSyncCtx,
} from '@features/aria/buildAriaInterviewRuntimeMergedSyncCtx';
import {
  mergeAriaInterviewCoreGateSyncCtx,
  mergeAriaInterviewRuntimeGateSyncCtx,
  mergeAriaInterviewServicesGateSyncCtx,
} from '@features/aria/buildInterviewGateSyncExtras';
import {
  mergeAriaInterviewCoreGateServicesBaseSyncCtx,
  mergeAriaInterviewCoreGateServicesFullSyncCtx,
} from '@features/aria/mergeAriaInterviewSyncContextHelpers';

export type ComposeAriaInterviewRuntimeLayerInput = {
  gateCtx: AriaInterviewDepsSyncContext;
  servicesGateCtx: AriaInterviewDepsSyncContext;
  webRuntimeLocal: InterviewWebRuntimeLocalScope;
  earlyDepsLocal: InterviewEarlyDepsLocalScope;
};

export type ComposeAriaInterviewCoreLayerInput = {
  runtimeGateCtx: AriaInterviewDepsSyncContext;
  gateCtx: AriaInterviewDepsSyncContext;
  servicesBaseCtx: AriaInterviewDepsSyncContext;
  servicesFullCtx: AriaInterviewDepsSyncContext;
  coreLocal: InterviewCoreLocalScope;
};

export type AriaInterviewRuntimeSyncContextLayer = {
  webRuntimeCtx: AriaInterviewDepsSyncContext;
  runtimeGateCtx: AriaInterviewDepsSyncContext;
  earlyDepsCtx: AriaInterviewDepsSyncContext;
};

export type AriaInterviewCoreSyncContextLayer = {
  coreCtx: AriaInterviewDepsSyncContext;
  coreGateCtx: AriaInterviewDepsSyncContext;
  coreGateServicesBaseCtx: AriaInterviewDepsSyncContext;
  coreGateServicesFullCtx: AriaInterviewDepsSyncContext;
};

export function composeAriaInterviewServicesGateSyncContextLayer(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
  gateCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewServicesGateSyncCtx(servicesBaseCtx, gateCtx);
}

export function composeAriaInterviewRuntimeSyncContextLayer(
  input: ComposeAriaInterviewRuntimeLayerInput,
): AriaInterviewRuntimeSyncContextLayer {
  const webRuntimeCtx = buildAriaInterviewWebRuntimeMergedSyncCtx(input.servicesGateCtx, input.webRuntimeLocal);
  const runtimeGateCtx = mergeAriaInterviewRuntimeGateSyncCtx(webRuntimeCtx, input.gateCtx);
  const earlyDepsCtx = buildInterviewEarlyDepsMergedSyncCtx(runtimeGateCtx, input.earlyDepsLocal);
  return { webRuntimeCtx, runtimeGateCtx, earlyDepsCtx };
}

export function composeAriaInterviewCoreSyncContextLayer(
  input: ComposeAriaInterviewCoreLayerInput,
): AriaInterviewCoreSyncContextLayer {
  const coreCtx = buildInterviewCoreMergedSyncCtx(input.runtimeGateCtx, input.coreLocal);
  const coreGateCtx = mergeAriaInterviewCoreGateSyncCtx(coreCtx, input.gateCtx);
  const coreGateServicesBaseCtx = mergeAriaInterviewCoreGateServicesBaseSyncCtx(
    coreGateCtx,
    input.servicesBaseCtx,
  );
  const coreGateServicesFullCtx = mergeAriaInterviewCoreGateServicesFullSyncCtx(
    coreGateCtx,
    input.servicesBaseCtx,
    input.servicesFullCtx,
  );
  return { coreCtx, coreGateCtx, coreGateServicesBaseCtx, coreGateServicesFullCtx };
}
