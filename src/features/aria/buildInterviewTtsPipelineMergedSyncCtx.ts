import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewSyncCtx } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewCoreWithLocalSyncCtx } from '@features/aria/mergeAriaInterviewSyncContextHelpers';
import { createInterviewTtsPipelineSyncExtra } from '@features/aria/createInterviewTtsPipelineSyncExtra';
import { buildInterviewTtsPipelineSyncExtra } from '@features/aria/buildInterviewTtsPipelineSyncExtra';
import type { InterviewTtsPipelineLocalScope } from '@features/aria/buildInterviewTtsPipelineLocalSyncExtra';
import { buildInterviewTtsPipelineLocalSyncExtra } from '@features/aria/buildInterviewTtsPipelineLocalSyncExtra';

export function buildInterviewTtsPipelineMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  localScope: InterviewTtsPipelineLocalScope,
): AriaInterviewDepsSyncContext {
  const localCtx = buildInterviewTtsPipelineLocalSyncExtra(localScope);
  /**
   * Slice delivery/probe refs from core+local — never from local alone. Local scope only carries
   * playback setters; slicing local-only used to overwrite showScenarioCard / elongating refs with
   * undefined and crash S3→M4 canonical TTS (`Cannot read property 'current' of undefined`).
   */
  const pipelineSlice = buildInterviewTtsPipelineSyncExtra(
    mergeAriaInterviewSyncCtx(coreCtx, localCtx),
  );
  return mergeAriaInterviewCoreWithLocalSyncCtx(
    coreCtx,
    createInterviewTtsPipelineSyncExtra(pipelineSlice),
  );
}
