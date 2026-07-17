import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type InterviewTtsPipelineLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'setTtsPlaybackReliabilityNotice'
  | 'setLastTtsCompletionCallbackMs'
  | 'speak'
  | 'applyInterviewSpeechComplete'
  | 'awaitTtsScreenReadyGate'
  | 'stopElevenLabsPlayback'
  | 'referenceCardShouldUpdateOnPlaybackStart'
  | 'persistInterviewAttemptSessionLifecycle'
  | 'applyReferenceCardFromAssistantSpeechRef'
  | 's1ContemptFixVersion'
  | 'setReferenceCardPrompt'
  | 'setReferenceCardScenario'
  | 'setInterviewUiPhase'
  | 'prepareInterviewTtsPlayback'
  | 'committedScenarioRef'
>;

export function buildInterviewTtsPipelineLocalSyncExtra(
  scope: InterviewTtsPipelineLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}
