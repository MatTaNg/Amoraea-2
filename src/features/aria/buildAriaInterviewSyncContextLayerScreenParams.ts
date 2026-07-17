import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import type { InterviewCoreLocalScope } from '@features/aria/buildInterviewCoreLocalSyncExtra';
import type { InterviewEarlyDepsLocalScope } from '@features/aria/buildInterviewEarlyDepsLocalSyncExtra';
import type { InterviewRuntimeLocalScope } from '@features/aria/buildInterviewRuntimeLocalSyncExtra';
import {
  composeAriaInterviewCoreSyncContextLayer,
  composeAriaInterviewRuntimeSyncContextLayer,
  type AriaInterviewCoreSyncContextLayer,
  type AriaInterviewRuntimeSyncContextLayer,
  type ComposeAriaInterviewCoreLayerInput,
  type ComposeAriaInterviewRuntimeLayerInput,
} from '@features/aria/composeAriaInterviewSyncContextLayers';

export type AriaInterviewRuntimeLayerScreenRefs = {
  gateCtx: AriaInterviewDepsSyncContext;
  servicesGateCtx: AriaInterviewDepsSyncContext;
  webRuntime: InterviewRuntimeLocalScope;
  earlyDeps: InterviewEarlyDepsLocalScope;
};

export type AriaInterviewCoreLayerScreenRefs = {
  runtimeGateCtx: AriaInterviewDepsSyncContext;
  gateCtx: AriaInterviewDepsSyncContext;
  servicesBaseCtx: AriaInterviewDepsSyncContext;
  servicesFullCtx: AriaInterviewDepsSyncContext;
  coreLocal: InterviewCoreLocalScope;
};

export function buildAriaInterviewRuntimeLayerInput(
  refs: AriaInterviewRuntimeLayerScreenRefs,
): ComposeAriaInterviewRuntimeLayerInput {
  return {
    gateCtx: refs.gateCtx,
    servicesGateCtx: refs.servicesGateCtx,
    runtimeLocal: refs.webRuntime,
    earlyDepsLocal: refs.earlyDeps,
  };
}

export function buildAriaInterviewCoreLayerInput(
  refs: AriaInterviewCoreLayerScreenRefs,
): ComposeAriaInterviewCoreLayerInput {
  return refs;
}

export function composeAriaInterviewRuntimeSyncContextLayerFromScreen(
  refs: AriaInterviewRuntimeLayerScreenRefs,
): AriaInterviewRuntimeSyncContextLayer {
  return composeAriaInterviewRuntimeSyncContextLayer(buildAriaInterviewRuntimeLayerInput(refs));
}

export function composeAriaInterviewCoreSyncContextLayerFromScreen(
  refs: AriaInterviewCoreLayerScreenRefs,
): AriaInterviewCoreSyncContextLayer {
  return composeAriaInterviewCoreSyncContextLayer(buildAriaInterviewCoreLayerInput(refs));
}
