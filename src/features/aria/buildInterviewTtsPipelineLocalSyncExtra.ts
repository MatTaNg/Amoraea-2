import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type InterviewTtsPipelineLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'mobileWebTapToBeginDone'
  | 'setWebTabGestureRestoreOverlay'
  | 'setWebDesktopPendingTtsGestureOverlay'
  | 'setTtsPlaybackReliabilityNotice'
  | 'setLastTtsCompletionCallbackMs'
  | 'speak'
  | 'applyInterviewSpeechComplete'
  | 'awaitTtsScreenReadyGate'
  | 'stopElevenLabsPlayback'
  | 'webSpeechShouldDeferToUserGesture'
  | 'rearmWebMicPreInitAfterTtsPlaybackComplete'
  | 'scheduleWebMicPreInitRefreshAfterTtsCompletes'
  | 'referenceCardShouldUpdateOnPlaybackStart'
  | 'persistInterviewAttemptSessionLifecycle'
  | 'applyReferenceCardFromAssistantSpeechRef'
  | 's1ContemptFixVersion'
  | 'setReferenceCardPrompt'
  | 'setReferenceCardScenario'
  | 'setInterviewUiPhase'
  | 'prepareInterviewTtsPlayback'
>;

export function buildInterviewTtsPipelineLocalSyncExtra(
  scope: InterviewTtsPipelineLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}
