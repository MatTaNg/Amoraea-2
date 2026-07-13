import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewEarlyDepsLiveStateSyncSlice,
  createInterviewEarlyDepsOrchestrationSyncSlice,
  createInterviewEarlyDepsRefsSyncSlice,
  createInterviewEarlyDepsSettersSyncSlice,
} from '@features/aria/createInterviewEarlyDepsSyncSlices';

/** Pick early-deps dep-sync fields from a merged interview sync context. */
export function buildInterviewEarlyDepsSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewEarlyDepsLiveStateSyncSlice(params),
    createInterviewEarlyDepsRefsSyncSlice(params),
    createInterviewEarlyDepsOrchestrationSyncSlice(params),
    createInterviewEarlyDepsSettersSyncSlice(params),
  );
}
