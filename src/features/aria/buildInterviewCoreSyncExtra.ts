import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewCoreMessageSettersSyncSlice,
  createInterviewCoreNameCaptureSyncSlice,
  createInterviewCoreScenarioStateSyncSlice,
  createInterviewCoreScoreRefsSyncSlice,
  createInterviewCoreSessionProgressSyncSlice,
  createInterviewCoreSpeechControlSyncSlice,
} from '@features/aria/createInterviewCoreSyncSlices';

/** Pick core dep-sync fields from a merged interview sync context. */
export function buildInterviewCoreSyncExtra(params: AriaInterviewDepsSyncContext): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewCoreSpeechControlSyncSlice(params),
    createInterviewCoreScenarioStateSyncSlice(params),
    createInterviewCoreSessionProgressSyncSlice(params),
    createInterviewCoreNameCaptureSyncSlice(params),
    createInterviewCoreMessageSettersSyncSlice(params),
    createInterviewCoreScoreRefsSyncSlice(params),
  );
}
