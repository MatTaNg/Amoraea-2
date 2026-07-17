import type { MutableRefObject } from 'react';

import type { PreparingResultsFailsafeDeps } from '@features/aria/preparingResultsFailsafeTypes';
import { syncAriaInterviewMicPipelineDeps } from '@features/aria/syncAriaInterviewMicPipelineDepsRefs';
import type { AriaInterviewDepsRefs, AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsTypes';
import type { InterviewMicPressLifecycleDeps } from '@features/aria/interviewMicPressLifecycleTypes';

export function syncInterviewMicPressLifecycleDeps(
  ref: MutableRefObject<InterviewMicPressLifecycleDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userId: ctx.userId,
    voiceState: ctx.voiceState,
    voiceStateRef: ctx.voiceStateRef,
    currentTranscript: ctx.currentTranscript,
    audioRecorder: ctx.audioRecorder,
    setVoiceState: ctx.setVoiceState,
    setMicWarning: ctx.setMicWarning,
    setMicEnginePrimed: ctx.setMicEnginePrimed,
    setMicPermission: ctx.setMicPermission,
    setCurrentTranscript: ctx.setCurrentTranscript,
    stopElevenLabsPlayback: ctx.stopElevenLabsPlayback,
    stopElevenLabsSpeech: ctx.stopElevenLabsSpeech,
    checkMicPermission: ctx.checkMicPermission,
    isInterviewerOutputActiveForMicGate: ctx.isInterviewerOutputActiveForMicGate,
    handleRecordingError: ctx.handleRecordingError,
    processUserSpeech: ctx.processUserSpeech,
    takeRecordingStartEventDataWithVadBypassRestart: ctx.takeRecordingStartEventDataWithVadBypassRestart,
    transcriptAtReleaseRef: ctx.transcriptAtReleaseRef,
    timingRef: ctx.timingRef,
    recognitionRef: ctx.recognitionRef,
    ttsLineInFlightRef: ctx.ttsLineInFlightRef,
    webMicArmInFlightRef: ctx.webMicArmInFlightRef,
    micTapWhileTtsActiveRef: ctx.micTapWhileTtsActiveRef,
    interviewNameRef: ctx.interviewNameRef,
    interviewNameReaskPendingRef: ctx.interviewNameReaskPendingRef,
    lastQuestionTextRef: ctx.lastQuestionTextRef,
    lastHeadphoneProbeRef: ctx.lastHeadphoneProbeRef,
    lastAudioRouteFingerprintRef: ctx.lastAudioRouteFingerprintRef,
    currentInterviewMomentRef: ctx.currentInterviewMomentRef,
    currentScenarioRef: ctx.currentScenarioRef,
    recordingDelayMeasurementRef: ctx.recordingDelayMeasurementRef,
  } as InterviewMicPressLifecycleDeps;
}

export function syncPreparingResultsFailsafeDeps(
  ref: MutableRefObject<PreparingResultsFailsafeDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
    isInterviewAppRoute: ctx.isInterviewAppRoute,
    userEmail: ctx.userEmail,
    navigation: ctx.navigation,
    interviewStatusRef: ctx.interviewStatusRef,
    scoreInterviewInFlightRef: ctx.scoreInterviewInFlightRef,
    scoreInterviewAttemptedRef: ctx.scoreInterviewAttemptedRef,
    pendingCompletionTranscriptRef: ctx.pendingCompletionTranscriptRef,
    interviewSessionAttemptIdRef: ctx.interviewSessionAttemptIdRef,
    interviewSessionIdRef: ctx.interviewSessionIdRef,
    setPendingScoringSyncAttemptId: ctx.setPendingScoringSyncAttemptId,
    kickCompletionScoring: ctx.kickCompletionScoring,
  } as PreparingResultsFailsafeDeps;
}

export function syncAriaInterviewMicCluster(
  refs: Pick<
    AriaInterviewDepsRefs,
    'transcribeSafeDepsRef' | 'audioRecorderDepsRef' | 'micLifecycleDepsRef' | 'handleNativeOrWhisperMicPressDepsRef'
  > & {
    webMicPressLifecycleDepsRef: MutableRefObject<InterviewMicPressLifecycleDeps>;
  },
  ctx: AriaInterviewDepsSyncContext,
): void {
  syncInterviewMicPressLifecycleDeps(refs.webMicPressLifecycleDepsRef, ctx);
  syncAriaInterviewMicPipelineDeps(refs, ctx);
}
