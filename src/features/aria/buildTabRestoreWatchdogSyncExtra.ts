import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewTabRestoreWatchdogOverlaySyncSlice,
  createInterviewTabRestoreWatchdogPlaybackSyncSlice,
  createInterviewTabRestoreWatchdogRecoverySyncSlice,
  createInterviewTabRestoreWatchdogTtsFlightSyncSlice,
  createInterviewTabRestoreWatchdogVoiceSyncSlice,
} from '@features/aria/createInterviewTabRestoreWatchdogSyncSlices';

/** Pick tab-restore watchdog dep-sync fields from a merged interview sync context. */
export function buildTabRestoreWatchdogSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewTabRestoreWatchdogVoiceSyncSlice(params),
    createInterviewTabRestoreWatchdogOverlaySyncSlice(params),
    createInterviewTabRestoreWatchdogTtsFlightSyncSlice(params),
    createInterviewTabRestoreWatchdogPlaybackSyncSlice(params),
    createInterviewTabRestoreWatchdogRecoverySyncSlice(params),
  );
}
