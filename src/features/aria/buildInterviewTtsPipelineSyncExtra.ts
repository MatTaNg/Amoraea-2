import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewTtsPipelineDeliveryRefsSyncSlice,
  createInterviewTtsPipelinePlaybackSyncSlice,
  createInterviewTtsPipelineScenarioProbeRefsSyncSlice,
  createInterviewTtsPipelineWebUiSyncSlice,
} from '@features/aria/createInterviewTtsPipelineSyncSlices';

/** Pick TTS pipeline dep-sync fields from a merged interview sync context. */
export function buildInterviewTtsPipelineSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewTtsPipelineWebUiSyncSlice(params),
    createInterviewTtsPipelinePlaybackSyncSlice(params),
    createInterviewTtsPipelineDeliveryRefsSyncSlice(params),
    createInterviewTtsPipelineScenarioProbeRefsSyncSlice(params),
  );
}
