import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewApplyReferenceCardFromAssistantSpeechSyncSlice,
  createInterviewDebouncedLiveTranscriptSyncSlice,
  createInterviewSaveActiveInterviewProgressSyncSlice,
  createInterviewScenarioTransitionUiSyncSlice,
} from '@features/aria/createInterviewPersistenceSyncSlices';

export function buildSaveActiveInterviewProgressSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewSaveActiveInterviewProgressSyncSlice(params);
}

export function buildDebouncedLiveTranscriptSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewDebouncedLiveTranscriptSyncSlice(params);
}

export function buildInterviewScenarioTransitionUiSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewScenarioTransitionUiSyncSlice(params);
}

export function buildApplyReferenceCardFromAssistantSpeechSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewApplyReferenceCardFromAssistantSpeechSyncSlice(params);
}
