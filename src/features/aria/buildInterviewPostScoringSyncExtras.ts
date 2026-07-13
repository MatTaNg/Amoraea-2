import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createAlphaModeCongratulationsFailsafeSyncSlice,
  createCheckInterviewStatusSyncSlice,
  createInterviewLoadingStatusFailsafeSyncSlice,
  createLoadStandardResultsReferralCodeSyncSlice,
  createPendingScoringSyncPollSyncSlice,
  createRecoverPendingDatabaseSaveSyncSlice,
  createRestorePreparingResultsInterviewStatusSyncSlice,
} from '@features/aria/createInterviewPostScoringSyncSlices';

export function buildRestorePreparingResultsInterviewStatusSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createRestorePreparingResultsInterviewStatusSyncSlice(params);
}

export function buildCheckInterviewStatusSyncExtra(params: AriaInterviewDepsSyncContext): AriaInterviewDepsSyncContext {
  return createCheckInterviewStatusSyncSlice(params);
}

export function buildPendingScoringSyncPollSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createPendingScoringSyncPollSyncSlice(params);
}

export function buildInterviewLoadingStatusFailsafeSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewLoadingStatusFailsafeSyncSlice(params);
}

export function buildAlphaModeCongratulationsFailsafeSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createAlphaModeCongratulationsFailsafeSyncSlice(params);
}

export function buildLoadStandardResultsReferralCodeSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createLoadStandardResultsReferralCodeSyncSlice(params);
}

export function buildRecoverPendingDatabaseSaveSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createRecoverPendingDatabaseSaveSyncSlice(params);
}
