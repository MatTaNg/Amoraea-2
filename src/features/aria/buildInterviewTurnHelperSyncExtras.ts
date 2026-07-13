import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createProcessTurnAudioSyncSlice,
  createResolveAssistantScenarioNumberSyncSlice,
} from '@features/aria/createInterviewTurnHelperSyncSlices';

export function buildResolveAssistantScenarioNumberSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createResolveAssistantScenarioNumberSyncSlice(params);
}

export function buildProcessTurnAudioSyncExtra(params: AriaInterviewDepsSyncContext): AriaInterviewDepsSyncContext {
  return createProcessTurnAudioSyncSlice(params);
}
