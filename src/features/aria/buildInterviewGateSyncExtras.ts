import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewSyncCtx } from '@features/aria/syncAriaInterviewDepsTypes';
import {
  createInterviewAssistantMetaExemptionSyncSlice,
  createInterviewClosingQuestionActionsSyncSlice,
  createInterviewResetInterviewProgressIdentitySyncSlice,
  createInterviewResetInterviewProgressMetaSkipSyncSlice,
  createInterviewResetInterviewProgressMomentsSyncSlice,
  createInterviewResetInterviewProgressResumeEmotionSyncSlice,
  createInterviewResetInterviewProgressSessionSyncSlice,
  createInterviewResetInterviewProgressWebTtsSyncSlice,
} from '@features/aria/createInterviewGateDepSyncSlices';

export function buildClosingQuestionActionsSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewClosingQuestionActionsSyncSlice(params);
}

export function buildInterviewAssistantMetaExemptionSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewAssistantMetaExemptionSyncSlice(params);
}

/** Pick reset-interview-progress dep-sync fields from a merged gate sync context. */
export function buildResetInterviewProgressSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewResetInterviewProgressIdentitySyncSlice(params),
    createInterviewResetInterviewProgressMomentsSyncSlice(params),
    createInterviewResetInterviewProgressWebTtsSyncSlice(params),
    createInterviewResetInterviewProgressResumeEmotionSyncSlice(params),
    createInterviewResetInterviewProgressMetaSkipSyncSlice(params),
    createInterviewResetInterviewProgressSessionSyncSlice(params),
  );
}

export function mergeAriaInterviewServicesGateSyncCtx(
  servicesCtx: AriaInterviewDepsSyncContext,
  gateCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewSyncCtx(servicesCtx, gateCtx);
}

export function mergeAriaInterviewRuntimeGateSyncCtx(
  runtimeCtx: AriaInterviewDepsSyncContext,
  gateCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewSyncCtx(runtimeCtx, gateCtx);
}

export function mergeAriaInterviewCoreGateSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  gateCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewSyncCtx(coreCtx, gateCtx);
}

export function mergeAriaInterviewMicClusterBaseSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  runtimeCtx: AriaInterviewDepsSyncContext,
  servicesGateCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewSyncCtx(
    mergeAriaInterviewSyncCtx(coreCtx, runtimeCtx),
    servicesGateCtx,
  );
}
