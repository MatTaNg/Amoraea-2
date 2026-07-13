import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewFetchStageScoreSyncSlice,
  createInterviewSaveScenarioCheckpointSyncSlice,
} from '@features/aria/createInterviewScenarioScoringAuxSyncSlices';

export function buildFetchStageScoreSyncExtra(params: AriaInterviewDepsSyncContext): AriaInterviewDepsSyncContext {
  return createInterviewFetchStageScoreSyncSlice(params);
}

export type FetchStageScoreLocalScope = Pick<AriaInterviewDepsSyncContext, 'typologyContext'>;

export function buildFetchStageScoreLocalSyncExtra(scope: FetchStageScoreLocalScope): AriaInterviewDepsSyncContext {
  return scope;
}

export function buildSaveScenarioCheckpointSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewSaveScenarioCheckpointSyncSlice(params);
}

export type SaveScenarioCheckpointLocalScope = Pick<AriaInterviewDepsSyncContext, 'saveInterviewToStorage'>;

export function buildSaveScenarioCheckpointLocalSyncExtra(
  scope: SaveScenarioCheckpointLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}
