import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type InterviewRuntimeLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'isInterviewAppRoute'
  | 'userIdRef'
  | 'voiceStateRef'
  | 'setVoiceState'
  | 'lastQuestionTextRef'
  | 'ttsLineInFlightRef'
  | 'recordingJustFinishedBeforeNextTtsRef'
  | 'postRecordingParallelStreamSettleRef'
  | 'transcriptAtReleaseRef'
  | 'timingRef'
  | 'lastVoiceTurnLanguageRef'
  | 'lastVoiceTurnConfidenceRef'
  | 'interruptAllInterviewTtsOutput'
>;

export function buildInterviewRuntimeLocalSyncExtra(
  scope: InterviewRuntimeLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}
