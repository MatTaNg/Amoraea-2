import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createEnsureValidSessionSyncSlice,
  createInterviewAttemptBootstrapSyncSlice,
  createInterviewAuthSignedOutSaveSyncSlice,
  createInterviewUnhandledRejectionSaveSyncSlice,
  createInterviewWebGreetingPrefetchSyncSlice,
} from '@features/aria/createInterviewBootSyncSlices';

export function buildInterviewWebGreetingPrefetchSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewWebGreetingPrefetchSyncSlice(params);
}

export function buildInterviewAttemptBootstrapSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewAttemptBootstrapSyncSlice(params);
}

export function buildInterviewUnhandledRejectionSaveSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewUnhandledRejectionSaveSyncSlice(params);
}

export function buildInterviewAuthSignedOutSaveSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewAuthSignedOutSaveSyncSlice(params);
}

export function buildEnsureValidSessionSyncExtra(params: AriaInterviewDepsSyncContext): AriaInterviewDepsSyncContext {
  return createEnsureValidSessionSyncSlice(params);
}

export type AriaInterviewServicesExtendedLocalScope = Pick<AriaInterviewDepsSyncContext, 'ensureValidSession'>;

export function buildAriaInterviewServicesExtendedLocalSyncExtra(
  scope: AriaInterviewServicesExtendedLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}
