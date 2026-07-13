import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewSyncCtx } from '@features/aria/syncAriaInterviewDepsRefs';
import { S1_CONTEMPT_FIX_VERSION } from '@features/aria/interviewAdminConfig';
import { createInterviewTurnHandlerSyncExtra } from '@features/aria/createInterviewTurnHandlerSyncExtra';
import { buildInterviewTurnHandlerSyncExtra } from '@features/aria/buildInterviewTurnHandlerSyncExtra';
import type { InterviewMicClusterLocalScope } from '@features/aria/buildInterviewMicClusterLocalSyncExtra';
import { buildInterviewMicClusterLocalSyncExtra } from '@features/aria/buildInterviewMicClusterLocalSyncExtra';
import {
  buildInterviewSessionLifecycleMergedSyncCtx,
  buildInterviewTurnHandlerMergedSyncCtx,
} from '@features/aria/buildInterviewClusterMergedSyncCtx';
import type { InterviewSessionLifecycleLocalScope } from '@features/aria/buildInterviewSessionLifecycleLocalSyncExtra';
import type { InterviewTurnHandlerLocalScope } from '@features/aria/buildInterviewTurnHandlerLocalSyncExtra';
import type { InterviewTtsPipelineLocalScope } from '@features/aria/buildInterviewTtsPipelineLocalSyncExtra';
import { buildInterviewTtsPipelineMergedSyncCtx } from '@features/aria/buildInterviewTtsPipelineMergedSyncCtx';

export type InterviewTtsPipelineScreenRefs = Omit<InterviewTtsPipelineLocalScope, 's1ContemptFixVersion'>;

export type InterviewMicClusterScreenRefs = {
  coreGateServicesBaseCtx: AriaInterviewDepsSyncContext;
  webRuntimeCtx: AriaInterviewDepsSyncContext;
  micCluster: InterviewMicClusterLocalScope;
};

export type InterviewTurnHandlerScreenRefs = InterviewTurnHandlerLocalScope;

export type InterviewSessionLifecycleScreenRefs = InterviewSessionLifecycleLocalScope;

export function createInterviewTtsPipelineSyncCtxFromScreen(
  coreCtx: AriaInterviewDepsSyncContext,
  ttsPipeline: InterviewTtsPipelineScreenRefs,
): AriaInterviewDepsSyncContext {
  return buildInterviewTtsPipelineMergedSyncCtx(coreCtx, {
    ...ttsPipeline,
    s1ContemptFixVersion: S1_CONTEMPT_FIX_VERSION,
  });
}

export function createInterviewTurnHandlerSyncCtxFromScreen(
  baseCtx: AriaInterviewDepsSyncContext,
  turnHandler: InterviewTurnHandlerScreenRefs,
): AriaInterviewDepsSyncContext {
  return createInterviewTurnHandlerSyncExtra(
    buildInterviewTurnHandlerSyncExtra(buildInterviewTurnHandlerMergedSyncCtx(baseCtx, turnHandler)),
  );
}

export function createInterviewMicClusterSyncCtxFromScreen(
  refs: InterviewMicClusterScreenRefs,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewSyncCtx(
    mergeAriaInterviewSyncCtx(refs.coreGateServicesBaseCtx, refs.webRuntimeCtx),
    buildInterviewMicClusterLocalSyncExtra(refs.micCluster),
  );
}

export function createInterviewSessionLifecycleSyncCtxFromScreen(
  baseCtx: AriaInterviewDepsSyncContext,
  sessionLifecycle: InterviewSessionLifecycleScreenRefs,
): AriaInterviewDepsSyncContext {
  return buildInterviewSessionLifecycleMergedSyncCtx(baseCtx, sessionLifecycle);
}
