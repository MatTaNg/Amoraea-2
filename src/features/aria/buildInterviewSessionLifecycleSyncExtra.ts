import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewSessionLifecycleAudioDeviceSyncSlice,
  createInterviewSessionLifecycleProbeRefsSyncSlice,
  createInterviewSessionLifecycleResumeWelcomeSyncSlice,
  createInterviewSessionLifecycleSettersSyncSlice,
  createInterviewSessionLifecycleStatusSyncSlice,
} from '@features/aria/createInterviewSessionLifecycleSyncSlices';

/** Pick session-lifecycle dep-sync fields from a merged interview sync context. */
export function buildInterviewSessionLifecycleSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewSessionLifecycleStatusSyncSlice(params),
    createInterviewSessionLifecycleResumeWelcomeSyncSlice(params),
    createInterviewSessionLifecycleProbeRefsSyncSlice(params),
    createInterviewSessionLifecycleSettersSyncSlice(params),
    createInterviewSessionLifecycleAudioDeviceSyncSlice(params),
  );
}
