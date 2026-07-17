import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type InterviewCoreLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'speakTextSafe'
  | 'setMessages'
  | 'setEmotionModalVisible'
  | 'setScenarioScores'
  | 'pendingCompletionTranscriptRef'
  | 'probeLogRef'
  | 'currentScenarioRef'
  | 'currentMessagesRef'
  | 'isInterviewCompleteRef'
  | 'scoredScenariosRef'
  | 'scenarioScoresRef'
>;

export function buildInterviewCoreLocalSyncExtra(scope: InterviewCoreLocalScope): AriaInterviewDepsSyncContext {
  return scope;
}
