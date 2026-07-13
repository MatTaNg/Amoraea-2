import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewTurnHandlerAssistantProcessingSyncSlice,
  createInterviewTurnHandlerClosingQuestionSyncSlice,
  createInterviewTurnHandlerEmotionModalSyncSlice,
  createInterviewTurnHandlerMetaSkipRefsSyncSlice,
  createInterviewTurnHandlerMiscRefsSyncSlice,
  createInterviewTurnHandlerMomentProbeRefsSyncSlice,
  createInterviewTurnHandlerProgressPersistenceSyncSlice,
  createInterviewTurnHandlerScenarioScoringSyncSlice,
  createInterviewTurnHandlerSessionBootstrapSyncSlice,
  createInterviewTurnHandlerStatusSettersSyncSlice,
  createInterviewTurnHandlerUiStageSyncSlice,
  createInterviewTurnHandlerWebTabRestoreSyncSlice,
} from '@features/aria/createInterviewTurnHandlerSyncSlices';

/** Pick turn-handler dep-sync fields from a merged interview sync context. */
export function buildInterviewTurnHandlerSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewTurnHandlerStatusSettersSyncSlice(params),
    createInterviewTurnHandlerEmotionModalSyncSlice(params),
    createInterviewTurnHandlerWebTabRestoreSyncSlice(params),
    createInterviewTurnHandlerScenarioScoringSyncSlice(params),
    createInterviewTurnHandlerClosingQuestionSyncSlice(params),
    createInterviewTurnHandlerProgressPersistenceSyncSlice(params),
    createInterviewTurnHandlerUiStageSyncSlice(params),
    createInterviewTurnHandlerAssistantProcessingSyncSlice(params),
    createInterviewTurnHandlerMomentProbeRefsSyncSlice(params),
    createInterviewTurnHandlerMetaSkipRefsSyncSlice(params),
    createInterviewTurnHandlerSessionBootstrapSyncSlice(params),
    createInterviewTurnHandlerMiscRefsSyncSlice(params),
  );
}
