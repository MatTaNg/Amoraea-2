import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewCoreWithLocalSyncCtx } from '@features/aria/mergeAriaInterviewSyncContextHelpers';
import { createInterviewTtsPipelineSyncExtra } from '@features/aria/createInterviewTtsPipelineSyncExtra';
import { buildInterviewTtsPipelineSyncExtra } from '@features/aria/buildInterviewTtsPipelineSyncExtra';
import type { InterviewTtsPipelineLocalScope } from '@features/aria/buildInterviewTtsPipelineLocalSyncExtra';
import { buildInterviewTtsPipelineLocalSyncExtra } from '@features/aria/buildInterviewTtsPipelineLocalSyncExtra';

export function buildInterviewTtsPipelineMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  localScope: InterviewTtsPipelineLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(
    coreCtx,
    createInterviewTtsPipelineSyncExtra(
      buildInterviewTtsPipelineSyncExtra(buildInterviewTtsPipelineLocalSyncExtra(localScope)),
    ),
  );
}
