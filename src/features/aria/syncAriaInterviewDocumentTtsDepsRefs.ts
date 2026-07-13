import type { MutableRefObject } from 'react';

import type { DeliverRecordingRetryLineDeps } from '@features/aria/deliverRecordingRetryLineTypes';
import type { InterruptInterviewTtsForDocumentHiddenDeps } from '@features/aria/interruptDocumentHiddenTtsTypes';
import type { InterviewDocumentVisibilityTtsDeps } from '@features/aria/interviewDocumentVisibilityTtsTypes';
import { isAssistantBubbleForTranscript } from '@features/aria/interviewReferenceCardResumeHelpers';
import type { TabRestoreWatchdogDeps } from '@features/aria/tabRestoreWatchdogTypes';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsTypes';

export function syncDeliverRecordingRetryLineDeps(
  ref: MutableRefObject<DeliverRecordingRetryLineDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    lastRecordingRetryDeliveredNormRef: ctx.lastRecordingRetryDeliveredNormRef,
    lastRecordingRetryDeliveredAtMsRef: ctx.lastRecordingRetryDeliveredAtMsRef,
    lastSuccessfulTtsTextNormalizedRef: ctx.lastSuccessfulTtsTextNormalizedRef,
    currentScenarioRef: ctx.currentScenarioRef,
    currentInterviewMomentRef: ctx.currentInterviewMomentRef,
    setVoiceState: ctx.setVoiceState,
    speakTextSafe: ctx.speakTextSafe,
    commitInterviewMessages: ctx.commitInterviewMessages,
  } as DeliverRecordingRetryLineDeps;
}

export function syncInterruptDocumentHiddenTtsDeps(
  ref: MutableRefObject<InterruptInterviewTtsForDocumentHiddenDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    interviewStatusRef: ctx.interviewStatusRef,
    userIdRef: ctx.userIdRef,
    ttsLineInFlightRef: ctx.ttsLineInFlightRef,
    parallelStreamingTtsRef: ctx.parallelStreamingTtsRef,
    isWebInterviewPlaybackSurfaceActive: ctx.isWebInterviewPlaybackSurfaceActive,
    gestureContextLostAtRef: ctx.gestureContextLostAtRef,
    isMobileWebInterviewTtsSessionActive: ctx.isMobileWebInterviewTtsSessionActive,
    armMobileWebBackgroundTtsContinue: ctx.armMobileWebBackgroundTtsContinue,
    tabHiddenDuringActiveTtsLineRef: ctx.tabHiddenDuringActiveTtsLineRef,
    webTtsUtteranceInFlightRef: ctx.webTtsUtteranceInFlightRef,
    lastQuestionTextRef: ctx.lastQuestionTextRef,
    webTtsTabInterruptPendingReplayRef: ctx.webTtsTabInterruptPendingReplayRef,
    webTabRestoreDeliveredNormRef: ctx.webTabRestoreDeliveredNormRef,
    webTabRestoreReplayInFlightRef: ctx.webTabRestoreReplayInFlightRef,
    mobileTabHideLetPlaybackContinueRef: ctx.mobileTabHideLetPlaybackContinueRef,
    mobileTabHideBackgroundUtteranceRef: ctx.mobileTabHideBackgroundUtteranceRef,
    pendingGestureRestoreSpeakRef: ctx.pendingGestureRestoreSpeakRef,
    needsGestureRestoreRef: ctx.needsGestureRestoreRef,
    tabVisibilityGestureLossPendingRef: ctx.tabVisibilityGestureLossPendingRef,
    webTtsSpeakGenerationRef: ctx.webTtsSpeakGenerationRef,
    setWebTabRestoreOverlayVisible: ctx.setWebTabRestoreOverlayVisible,
    setTtsPlaybackActive: ctx.setTtsPlaybackActive,
    setVoiceState: ctx.setVoiceState,
    pendingEmotionModalTransitionRef: ctx.pendingEmotionModalTransitionRef,
    emotionModalShownForScenarioRef: ctx.emotionModalShownForScenarioRef,
  } as InterruptInterviewTtsForDocumentHiddenDeps;
}

export function syncInterviewDocumentVisibilityTtsDeps(
  ref: MutableRefObject<InterviewDocumentVisibilityTtsDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    docVisibilityWasHiddenRef: ctx.docVisibilityWasHiddenRef,
    interruptInterviewTtsForDocumentHidden: ctx.interruptInterviewTtsForDocumentHidden,
    interviewStatusRef: ctx.interviewStatusRef,
    isInterviewCompleteRef: ctx.isInterviewCompleteRef,
    currentMessagesRef: ctx.currentMessagesRef,
    syncInterviewTtsAfterScreenReturn: ctx.syncInterviewTtsAfterScreenReturn,
    webTabRestoreReplayInFlightRef: ctx.webTabRestoreReplayInFlightRef,
    needsGestureRestoreRef: ctx.needsGestureRestoreRef,
    tabVisibilityGestureLossPendingRef: ctx.tabVisibilityGestureLossPendingRef,
    setWebTabRestoreOverlayVisible: ctx.setWebTabRestoreOverlayVisible,
    ensureWebGestureFlushListener: ctx.ensureWebGestureFlushListener,
    handleWebTabGestureRestoreTapRef: ctx.handleWebTabGestureRestoreTapRef,
    mobileTabHideLetPlaybackContinueRef: ctx.mobileTabHideLetPlaybackContinueRef,
    pendingGestureRestoreSpeakRef: ctx.pendingGestureRestoreSpeakRef,
    tabHiddenDuringActiveTtsLineRef: ctx.tabHiddenDuringActiveTtsLineRef,
    hasWebInterviewHtmlAudioTabResumePending: ctx.hasWebInterviewHtmlAudioTabResumePending,
    isWebInterviewPlaybackAudiblyActive: ctx.isWebInterviewPlaybackAudiblyActive,
    committedScenarioRef: ctx.committedScenarioRef,
    isAssistantBubbleForTranscript:
      ctx.isAssistantBubbleForTranscript ?? isAssistantBubbleForTranscript,
    setInterviewUiPhase: ctx.setInterviewUiPhase,
    setReferenceCardPrompt: ctx.setReferenceCardPrompt,
    setReferenceCardScenario: ctx.setReferenceCardScenario,
    pendingEmotionModalTransitionRef: ctx.pendingEmotionModalTransitionRef,
    emotionModalShownForScenarioRef: ctx.emotionModalShownForScenarioRef,
  } as InterviewDocumentVisibilityTtsDeps;
}

export function syncTabRestoreWatchdogDeps(
  ref: MutableRefObject<TabRestoreWatchdogDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    voiceStateRef: ctx.voiceStateRef,
    webTabGestureRestoreOverlayRef: ctx.webTabGestureRestoreOverlayRef,
    interviewStatusRef: ctx.interviewStatusRef,
    mobileTabHideLetPlaybackContinueRef: ctx.mobileTabHideLetPlaybackContinueRef,
    pendingGestureRestoreSpeakRef: ctx.pendingGestureRestoreSpeakRef,
    webTtsTabInterruptPendingReplayRef: ctx.webTtsTabInterruptPendingReplayRef,
    ttsLineInFlightRef: ctx.ttsLineInFlightRef,
    webTabRestoreReplayInFlightRef: ctx.webTabRestoreReplayInFlightRef,
    parallelStreamingTtsRef: ctx.parallelStreamingTtsRef,
    webTtsUtteranceInFlightRef: ctx.webTtsUtteranceInFlightRef,
    staleWebTtsRuntimeLockSinceMsRef: ctx.staleWebTtsRuntimeLockSinceMsRef,
    tabRestoreInFlightWithoutPlaybackSinceMsRef: ctx.tabRestoreInFlightWithoutPlaybackSinceMsRef,
    speakingWithoutPlaybackSinceMsRef: ctx.speakingWithoutPlaybackSinceMsRef,
    needsGestureRestoreRef: ctx.needsGestureRestoreRef,
    webTabRestoreDeliveredNormRef: ctx.webTabRestoreDeliveredNormRef,
    lastSuccessfulTtsTextNormalizedRef: ctx.lastSuccessfulTtsTextNormalizedRef,
    isWebInterviewPlaybackSurfaceActive: ctx.isWebInterviewPlaybackSurfaceActive,
    isWebInterviewPlaybackAudiblyActive: ctx.isWebInterviewPlaybackAudiblyActive,
    hasWebInterviewHtmlAudioTabResumePending: ctx.hasWebInterviewHtmlAudioTabResumePending,
    isWebInterviewMidUtteranceTabResumeActive: ctx.isWebInterviewMidUtteranceTabResumeActive,
    isInterviewerOutputActiveForMicGate: ctx.isInterviewerOutputActiveForMicGate,
    queueMobileWebHtmlResumeAfterScreenReturn: ctx.queueMobileWebHtmlResumeAfterScreenReturn,
    resolveStaleWebTtsRuntimeLockThresholdMs: ctx.resolveStaleWebTtsRuntimeLockThresholdMs,
    clearStaleWebInterviewTtsRuntimeLocks: ctx.clearStaleWebInterviewTtsRuntimeLocks,
    interruptAllWebInterviewTtsOutput: ctx.interruptAllWebInterviewTtsOutput,
    dismissAfterAndroidBackgroundPlaybackEnd: ctx.dismissAfterAndroidBackgroundPlaybackEnd,
    dismissTabRestoreOverlay: ctx.dismissTabRestoreOverlay,
    ensureWebGestureFlushListener: ctx.ensureWebGestureFlushListener,
    setWebInterviewerOutputActive: ctx.setWebInterviewerOutputActive,
    setWebTabRestoreOverlayVisible: ctx.setWebTabRestoreOverlayVisible,
    setVoiceState: ctx.setVoiceState,
    tabRestoreHtmlPlayStartTimeoutMs: ctx.tabRestoreHtmlPlayStartTimeoutMs,
    tabHiddenDuringActiveTtsLineRef: ctx.tabHiddenDuringActiveTtsLineRef,
  } as TabRestoreWatchdogDeps;
}
