import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewDeliverRecordingRetryLineActionsSyncSlice,
  createInterviewDeliverRecordingRetryLineRefsSyncSlice,
} from '@features/aria/createInterviewDeliverRecordingRetryLineSyncSlices';

/** Pick deliver-recording-retry-line dep-sync fields from a merged interview sync context. */
export function buildDeliverRecordingRetryLineSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewDeliverRecordingRetryLineRefsSyncSlice(params),
    createInterviewDeliverRecordingRetryLineActionsSyncSlice(params),
  );
}

export type DeliverRecordingRetryLineLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'commitInterviewMessages'
  | 'lastRecordingRetryDeliveredNormRef'
  | 'lastRecordingRetryDeliveredAtMsRef'
  | 'currentScenarioRef'
  | 'currentInterviewMomentRef'
>;

export function buildDeliverRecordingRetryLineLocalSyncExtra(
  scope: DeliverRecordingRetryLineLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}
