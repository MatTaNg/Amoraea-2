import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type InterviewEarlyDepsLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'emotionItemsComplete'
  | 'status'
  | 'voiceState'
  | 'emotionModalVisible'
  | 'emotionModalItemIndex'
  | 'statusRef'
  | 'emotionModalResolveRef'
  | 'emotionModalOpenForIndexRef'
  | 'emotionModalTimeoutRef'
  | 'emotionModalShownForScenarioRef'
  | 'maybeAwaitEmotionAfterScenarioTransitionRef'
  | 'runEmotionModalAfterScenarioTransitionRef'
  | 'tryRunEmotionModalFromScenarioTransitionRef'
  | 'setEmotionItemResponses'
  | 'setEmotionItemsComplete'
  | 'setEmotionModalVisible'
  | 'setEmotionModalItemIndex'
>;

export function buildInterviewEarlyDepsLocalSyncExtra(
  scope: InterviewEarlyDepsLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}
