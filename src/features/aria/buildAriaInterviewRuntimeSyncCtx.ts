import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewRuntimeIdentitySyncSlice,
  createInterviewRuntimeInterruptSyncSlice,
  createInterviewRuntimeRecordingTimingSyncSlice,
  createInterviewRuntimeResumeRepeatSyncSlice,
  createInterviewRuntimeSessionRefsSyncSlice,
  createInterviewRuntimeTtsFlightSyncSlice,
  createInterviewRuntimeTurnMetadataSyncSlice,
  createInterviewRuntimeVoiceStateSyncSlice,
} from '@features/aria/createInterviewRuntimeSyncSlices';

/** Pick web-runtime dep-sync fields from a merged interview sync context. */
export function buildAriaInterviewRuntimeSyncCtx(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewRuntimeIdentitySyncSlice(params),
    createInterviewRuntimeSessionRefsSyncSlice(params),
    createInterviewRuntimeVoiceStateSyncSlice(params),
    createInterviewRuntimeTtsFlightSyncSlice(params),
    createInterviewRuntimeRecordingTimingSyncSlice(params),
    createInterviewRuntimeResumeRepeatSyncSlice(params),
    createInterviewRuntimeTurnMetadataSyncSlice(params),
    createInterviewRuntimeInterruptSyncSlice(params),
  );
}
