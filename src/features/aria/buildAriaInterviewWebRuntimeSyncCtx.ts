import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewWebRuntimeGestureRestoreSyncSlice,
  createInterviewWebRuntimeIdentitySyncSlice,
  createInterviewWebRuntimeInterruptSyncSlice,
  createInterviewWebRuntimeRecordingTimingSyncSlice,
  createInterviewWebRuntimeResumeRepeatSyncSlice,
  createInterviewWebRuntimeSessionRefsSyncSlice,
  createInterviewWebRuntimeTabHidePlaybackSyncSlice,
  createInterviewWebRuntimeTtsFlightSyncSlice,
  createInterviewWebRuntimeTurnMetadataSyncSlice,
  createInterviewWebRuntimeVoiceStateSyncSlice,
} from '@features/aria/createInterviewWebRuntimeSyncSlices';

/** Pick web-runtime dep-sync fields from a merged interview sync context. */
export function buildAriaInterviewWebRuntimeSyncCtx(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewWebRuntimeIdentitySyncSlice(params),
    createInterviewWebRuntimeSessionRefsSyncSlice(params),
    createInterviewWebRuntimeVoiceStateSyncSlice(params),
    createInterviewWebRuntimeTtsFlightSyncSlice(params),
    createInterviewWebRuntimeGestureRestoreSyncSlice(params),
    createInterviewWebRuntimeTabHidePlaybackSyncSlice(params),
    createInterviewWebRuntimeRecordingTimingSyncSlice(params),
    createInterviewWebRuntimeResumeRepeatSyncSlice(params),
    createInterviewWebRuntimeTurnMetadataSyncSlice(params),
    createInterviewWebRuntimeInterruptSyncSlice(params),
  );
}
