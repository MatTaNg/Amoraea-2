import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewPerformAdminResetClosingQuestionSyncSlice,
  createInterviewPerformAdminResetIdentitySyncSlice,
  createInterviewPerformAdminResetInterviewResetSyncSlice,
  createInterviewPerformAdminResetMediaSyncSlice,
  createInterviewPerformAdminResetPostInterviewSyncSlice,
  createInterviewPerformAdminResetSessionRefsSyncSlice,
} from '@features/aria/createInterviewPerformAdminResetSyncSlices';

/** Pick perform-admin-reset dep-sync fields from a merged interview sync context. */
export function buildPerformAdminInterviewResetSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewPerformAdminResetIdentitySyncSlice(params),
    createInterviewPerformAdminResetMediaSyncSlice(params),
    createInterviewPerformAdminResetSessionRefsSyncSlice(params),
    createInterviewPerformAdminResetClosingQuestionSyncSlice(params),
    createInterviewPerformAdminResetInterviewResetSyncSlice(params),
    createInterviewPerformAdminResetPostInterviewSyncSlice(params),
  );
}
