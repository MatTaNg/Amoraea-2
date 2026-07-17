import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewApplyRouteProbeAfterResumeSyncSlice,
  createInterviewHandleRecordingErrorSyncSlice,
  createInterviewHandleSendTypedSyncSlice,
  createInterviewWebSpeechRecognitionSyncSlice,
} from '@features/aria/createInterviewMicTurnAuxSyncSlices';

export function buildInterviewWebSpeechRecognitionSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewWebSpeechRecognitionSyncSlice(params);
}

export type InterviewWebSpeechRecognitionLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'recognitionRef'
  | 'setCurrentTranscript'
  | 'transcriptAtReleaseRef'
  | 'setMicError'
  | 'setMicWarning'
>;

export function buildInterviewWebSpeechRecognitionLocalSyncExtra(
  scope: InterviewWebSpeechRecognitionLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}

export function buildHandleRecordingErrorSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewHandleRecordingErrorSyncSlice(params);
}

export type HandleRecordingErrorLocalScope = Pick<AriaInterviewDepsSyncContext, 'useWebCopy'>;

export function buildHandleRecordingErrorLocalSyncExtra(scope: HandleRecordingErrorLocalScope): AriaInterviewDepsSyncContext {
  return scope;
}

export function buildApplyRouteProbeAfterResumeSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewApplyRouteProbeAfterResumeSyncSlice(params);
}

export type ApplyRouteProbeAfterResumeLocalScope = Pick<AriaInterviewDepsSyncContext, 'setAudioRouteKind'>;

export function buildApplyRouteProbeAfterResumeLocalSyncExtra(
  scope: ApplyRouteProbeAfterResumeLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}

export function buildHandleSendTypedSyncExtra(params: AriaInterviewDepsSyncContext): AriaInterviewDepsSyncContext {
  return createInterviewHandleSendTypedSyncSlice(params);
}

export type HandleSendTypedLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'touchActivity'
  | 'setTypedAnswer'
  | 'setMicWarning'
  | 'stopElevenLabsSpeech'
  | 'processUserSpeech'
>;

export function buildHandleSendTypedLocalSyncExtra(scope: HandleSendTypedLocalScope): AriaInterviewDepsSyncContext {
  return scope;
}
