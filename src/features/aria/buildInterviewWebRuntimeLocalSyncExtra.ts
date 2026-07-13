import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type InterviewWebRuntimeLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'isInterviewAppRoute'
  | 'userIdRef'
  | 'voiceStateRef'
  | 'setVoiceState'
  | 'lastQuestionTextRef'
  | 'ttsLineInFlightRef'
  | 'pendingGestureRestoreSpeakRef'
  | 'mobileTabHideLetPlaybackContinueRef'
  | 'tabHiddenDuringActiveTtsLineRef'
  | 'needsGestureRestoreRef'
  | 'tabVisibilityGestureLossPendingRef'
  | 'ensureWebGestureFlushListener'
  | 'detachWebGestureFlushListener'
  | 'setWebTabRestoreOverlayVisible'
  | 'setMobileWebTapToBeginDone'
  | 'pendingWebSpeechForGestureRef'
  | 'recordingJustFinishedBeforeNextTtsRef'
  | 'postRecordingParallelStreamSettleRef'
  | 'transcriptAtReleaseRef'
  | 'timingRef'
  | 'lastVoiceTurnLanguageRef'
  | 'lastVoiceTurnConfidenceRef'
  | 'interruptAllWebInterviewTtsOutput'
>;

export function buildInterviewWebRuntimeLocalSyncExtra(
  scope: InterviewWebRuntimeLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}
