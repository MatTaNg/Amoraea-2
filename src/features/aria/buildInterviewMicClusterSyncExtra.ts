import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewMicClusterLiveStateSyncSlice,
  createInterviewMicClusterPlaybackGateSyncSlice,
  createInterviewMicClusterPressHandlersSyncSlice,
  createInterviewMicClusterRecordingPipelineSyncSlice,
  createInterviewMicClusterRecordingRefsSyncSlice,
  createInterviewMicClusterRouteProbeSyncSlice,
  createInterviewMicClusterSettersSyncSlice,
  createInterviewMicClusterWebTtsResumeSyncSlice,
} from '@features/aria/createInterviewMicClusterSyncSlices';

/** Pick mic-cluster dep-sync fields from a merged interview sync context. */
export function buildInterviewMicClusterSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewMicClusterLiveStateSyncSlice(params),
    createInterviewMicClusterSettersSyncSlice(params),
    createInterviewMicClusterPlaybackGateSyncSlice(params),
    createInterviewMicClusterRecordingPipelineSyncSlice(params),
    createInterviewMicClusterRecordingRefsSyncSlice(params),
    createInterviewMicClusterRouteProbeSyncSlice(params),
    createInterviewMicClusterWebTtsResumeSyncSlice(params),
    createInterviewMicClusterPressHandlersSyncSlice(params),
  );
}
