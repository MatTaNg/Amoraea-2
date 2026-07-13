import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewPerformRetakeClosingQuestionSyncSlice,
  createInterviewPerformRetakeIdentitySyncSlice,
  createInterviewPerformRetakeInterviewResetSyncSlice,
  createInterviewPerformRetakePostInterviewSyncSlice,
  createInterviewPerformRetakeSessionRefsSyncSlice,
} from '@features/aria/createInterviewPerformRetakeSyncSlices';

/** Pick perform-retake dep-sync fields from a merged interview sync context. */
export function buildPerformInterviewRetakeSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewPerformRetakeIdentitySyncSlice(params),
    createInterviewPerformRetakeSessionRefsSyncSlice(params),
    createInterviewPerformRetakeClosingQuestionSyncSlice(params),
    createInterviewPerformRetakeInterviewResetSyncSlice(params),
    createInterviewPerformRetakePostInterviewSyncSlice(params),
  );
}
