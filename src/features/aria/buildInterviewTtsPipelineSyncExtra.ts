import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { assignDefinedSyncSlices } from '@features/aria/syncAriaInterviewDepsTypes';
import {
  createInterviewTtsPipelineDeliveryRefsSyncSlice,
  createInterviewTtsPipelinePlaybackSyncSlice,
  createInterviewTtsPipelineScenarioProbeRefsSyncSlice,
} from '@features/aria/createInterviewTtsPipelineSyncSlices';

/** Pick TTS pipeline dep-sync fields from a merged interview sync context. */
export function buildInterviewTtsPipelineSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return assignDefinedSyncSlices(
    createInterviewTtsPipelinePlaybackSyncSlice(params),
    createInterviewTtsPipelineDeliveryRefsSyncSlice(params),
    createInterviewTtsPipelineScenarioProbeRefsSyncSlice(params),
  );
}
