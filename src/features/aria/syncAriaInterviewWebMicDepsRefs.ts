import type { MutableRefObject } from 'react';

import type { PreparingResultsFailsafeDeps } from '@features/aria/preparingResultsFailsafeTypes';
import { syncAriaInterviewMicPipelineDeps } from '@features/aria/syncAriaInterviewMicPipelineDepsRefs';
import type { AriaInterviewDepsRefs, AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsTypes';
import type { WebMicPressLifecycleDeps } from '@features/aria/webMicPressLifecycleTypes';
import type { WebResumeWelcomeTapDeps } from '@features/aria/webResumeWelcomeTapTypes';

export function syncWebMicPressLifecycleDeps(
  ref: MutableRefObject<WebMicPressLifecycleDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userId: ctx.userId,
    voiceState: ctx.voiceState,
    voiceStateRef: ctx.voiceStateRef,
    useMediaRecorderPath: ctx.useMediaRecorderPath,
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
    isWebInterviewPlaybackSurfaceActive: ctx.isWebInterviewPlaybackSurfaceActive,
    webSpeechShouldDeferToUserGesture: ctx.webSpeechShouldDeferToUserGesture,
    handleRecordingError: ctx.handleRecordingError,
    processUserSpeech: ctx.processUserSpeech,
    takeRecordingStartEventDataWithVadBypassRestart: ctx.takeRecordingStartEventDataWithVadBypassRestart,
    pendingWebSpeechForGestureRef: ctx.pendingWebSpeechForGestureRef,
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
  } as WebMicPressLifecycleDeps;
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

export function syncWebResumeWelcomeTapDeps(
  ref: MutableRefObject<WebResumeWelcomeTapDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    interviewSessionAttemptIdRef: ctx.interviewSessionAttemptIdRef,
    isInterviewCompleteRef: ctx.isInterviewCompleteRef,
    interviewStatusRef: ctx.interviewStatusRef,
    currentMessagesRef: ctx.currentMessagesRef,
    webResumeWelcomeTapHandledRef: ctx.webResumeWelcomeTapHandledRef,
    webResumeWelcomeTapPendingRef: ctx.webResumeWelcomeTapPendingRef,
    setWebResumeWelcomeTapPending: ctx.setWebResumeWelcomeTapPending,
    resumeOfferWelcomeTtsRef: ctx.resumeOfferWelcomeTtsRef,
    pendingWebSpeechForGestureRef: ctx.pendingWebSpeechForGestureRef,
    detachWebGestureFlushListener: ctx.detachWebGestureFlushListener,
    setWebDesktopPendingTtsGestureOverlay: ctx.setWebDesktopPendingTtsGestureOverlay,
    setMobileWebTapToBeginDone: ctx.setMobileWebTapToBeginDone,
    emotionModalPendingTransitionRef: ctx.emotionModalPendingTransitionRef,
    setEmotionModalVisible: ctx.setEmotionModalVisible,
    resumeEmotionCatchUpIndicesRef: ctx.resumeEmotionCatchUpIndicesRef,
    awaitEmotionModalForIndex: ctx.awaitEmotionModalForIndex,
    resumeWelcomeMessageRef: ctx.resumeWelcomeMessageRef,
    speakTextSafe: ctx.speakTextSafe,
    pendingScenarioIntroAfterResumeWelcomeRef: ctx.pendingScenarioIntroAfterResumeWelcomeRef,
    resumeEmotionAfterModalTextRef: ctx.resumeEmotionAfterModalTextRef,
    resumeLastAssistantTextRef: ctx.resumeLastAssistantTextRef,
    lastQuestionTextRef: ctx.lastQuestionTextRef,
    resumeRepeatChoicePendingRef: ctx.resumeRepeatChoicePendingRef,
  } as WebResumeWelcomeTapDeps;
}

export function syncAriaInterviewMicCluster(
  refs: Pick<
    AriaInterviewDepsRefs,
    'transcribeSafeDepsRef' | 'audioRecorderDepsRef' | 'micLifecycleDepsRef' | 'handleNativeOrWhisperMicPressDepsRef'
  > & {
    webMicPressLifecycleDepsRef: MutableRefObject<WebMicPressLifecycleDeps>;
  },
  ctx: AriaInterviewDepsSyncContext,
): void {
  syncWebMicPressLifecycleDeps(refs.webMicPressLifecycleDepsRef, ctx);
  syncAriaInterviewMicPipelineDeps(refs, ctx);
}
