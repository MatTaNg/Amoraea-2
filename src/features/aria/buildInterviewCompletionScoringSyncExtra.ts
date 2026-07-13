import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewCompletionScoringActionsSyncSlice,
  createInterviewCompletionScoringIdentitySyncSlice,
  createInterviewCompletionScoringRefsSyncSlice,
} from '@features/aria/createInterviewCompletionScoringSyncSlices';

/** Pick completion-scoring dep-sync fields from a merged interview sync context. */
export function buildInterviewCompletionScoringSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return {
    ...params,
    ...Object.assign(
      {},
      createInterviewCompletionScoringIdentitySyncSlice(params),
      createInterviewCompletionScoringActionsSyncSlice(params),
      createInterviewCompletionScoringRefsSyncSlice(params),
    ),
  };
}
