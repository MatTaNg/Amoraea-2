import type { MutableRefObject } from 'react';

import type { AriaInterviewRuntimeDepSyncWiringParams } from '@features/aria/hooks/useAriaInterviewRuntimeDepSyncWiring';
import type { EmotionModalOrchestrationDeps } from '@features/aria/emotionModalOrchestrationTypes';
import type { useAriaInterviewSession } from '@features/aria/hooks/useAriaInterviewSession';
import type { InterviewWebTtsRuntimeDeps } from '@features/aria/hooks/useInterviewWebTtsRuntime';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type BuildAriaInterviewRuntimeDepSyncWiringParamsFromScreenInput = {
  gateCtx: AriaInterviewDepsSyncContext;
  servicesGateCtx: AriaInterviewDepsSyncContext;
  emotionModalOrchestrationDepsRef: MutableRefObject<EmotionModalOrchestrationDeps>;
  webTtsRuntimeDepsRef: MutableRefObject<InterviewWebTtsRuntimeDeps>;
  session: AriaInterviewScreenSessionState;
  interview: ReturnType<typeof useAriaInterviewSession>;
  userIdRef: MutableRefObject<string>;
  interviewSession: {
    voiceStateRef: MutableRefObject<unknown>;
    setVoiceState: AriaInterviewRuntimeDepSyncWiringParams['webRuntime']['setVoiceState'];
    pendingGestureRestoreSpeakRef: MutableRefObject<unknown>;
    tabVisibilityGestureLossPendingRef: MutableRefObject<unknown>;
    needsGestureRestoreRef: MutableRefObject<unknown>;
    setMobileWebTapToBeginDone: (value: boolean) => void;
    pendingWebSpeechForGestureRef: MutableRefObject<unknown>;
    transcriptAtReleaseRef: MutableRefObject<unknown>;
    setWebTabRestoreOverlayVisible: (value: boolean) => void;
  };
  webTts: {
    ensureWebGestureFlushListener: AriaInterviewRuntimeDepSyncWiringParams['webRuntime']['ensureWebGestureFlushListener'];
    detachWebGestureFlushListener: AriaInterviewRuntimeDepSyncWiringParams['webRuntime']['detachWebGestureFlushListener'];
    interruptAllWebInterviewTtsOutput: AriaInterviewRuntimeDepSyncWiringParams['webRuntime']['interruptAllWebInterviewTtsOutput'];
    waitForWebInterviewTtsQuiescentBeforeEmotionModal: AriaInterviewRuntimeDepSyncWiringParams['earlyDeps']['waitForWebInterviewTtsQuiescentBeforeEmotionModal'];
    waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal: AriaInterviewRuntimeDepSyncWiringParams['earlyDeps']['waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal'];
  };
};

/** Assemble runtime dep-sync params from session state + upstream web-TTS/emotion outputs. */
export function buildAriaInterviewRuntimeDepSyncWiringParamsFromScreen(
  input: BuildAriaInterviewRuntimeDepSyncWiringParamsFromScreenInput,
): AriaInterviewRuntimeDepSyncWiringParams {
  const {
    gateCtx,
    servicesGateCtx,
    emotionModalOrchestrationDepsRef,
    webTtsRuntimeDepsRef,
    session,
    interview,
    userIdRef,
    interviewSession,
    webTts,
  } = input;
  const { status, voiceState } = interview;
  const { routing, shell, gate } = session;
  const { isInterviewAppRoute } = routing;
  const {
    emotionItemsComplete,
    emotionModalVisible,
    emotionModalItemIndex,
    statusRef,
    emotionModalOpenForIndexRef,
    maybeAwaitEmotionAfterScenarioTransitionRef,
    runEmotionModalAfterScenarioTransitionRef,
    setEmotionItemResponses,
    setEmotionItemsComplete,
    setEmotionModalVisible,
    setEmotionModalItemIndex,
    lastQuestionTextRef,
    ttsLineInFlightRef,
    timingRef,
    lastVoiceTurnLanguageRef,
    lastVoiceTurnConfidenceRef,
    postRecordingParallelStreamSettleRef,
    mobileTabHideLetPlaybackContinueRef,
    recordingJustFinishedBeforeNextTtsRef,
    tabHiddenDuringActiveTtsLineRef,
  } = shell;
  const { emotionModalResolveRef, emotionModalTimeoutRef, emotionModalShownForScenarioRef } = gate.resumeEmotion;
  const { tryRunEmotionModalFromScenarioTransitionRef } = gate.metaSkip;
  const {
    voiceStateRef,
    setVoiceState,
    pendingGestureRestoreSpeakRef,
    tabVisibilityGestureLossPendingRef,
    needsGestureRestoreRef,
    setMobileWebTapToBeginDone,
    pendingWebSpeechForGestureRef,
    transcriptAtReleaseRef,
    setWebTabRestoreOverlayVisible,
  } = interviewSession;

  return {
    gateCtx,
    servicesGateCtx,
    emotionModalOrchestrationDepsRef,
    webTtsRuntimeDepsRef,
    webRuntime: {
      isInterviewAppRoute,
      userIdRef,
      voiceStateRef,
      setVoiceState,
      lastQuestionTextRef,
      ttsLineInFlightRef,
      pendingGestureRestoreSpeakRef,
      mobileTabHideLetPlaybackContinueRef,
      tabHiddenDuringActiveTtsLineRef,
      needsGestureRestoreRef,
      tabVisibilityGestureLossPendingRef,
      ensureWebGestureFlushListener: webTts.ensureWebGestureFlushListener,
      detachWebGestureFlushListener: webTts.detachWebGestureFlushListener,
      setWebTabRestoreOverlayVisible,
      setMobileWebTapToBeginDone,
      pendingWebSpeechForGestureRef,
      recordingJustFinishedBeforeNextTtsRef,
      postRecordingParallelStreamSettleRef,
      transcriptAtReleaseRef,
      timingRef,
      lastVoiceTurnLanguageRef,
      lastVoiceTurnConfidenceRef,
      interruptAllWebInterviewTtsOutput: webTts.interruptAllWebInterviewTtsOutput,
    },
    earlyDeps: {
      emotionItemsComplete,
      status,
      voiceState,
      emotionModalVisible,
      emotionModalItemIndex,
      statusRef,
      emotionModalResolveRef,
      emotionModalOpenForIndexRef,
      emotionModalTimeoutRef,
      emotionModalShownForScenarioRef,
      maybeAwaitEmotionAfterScenarioTransitionRef,
      runEmotionModalAfterScenarioTransitionRef,
      tryRunEmotionModalFromScenarioTransitionRef,
      setEmotionItemResponses,
      setEmotionItemsComplete,
      setEmotionModalVisible,
      setEmotionModalItemIndex,
      waitForWebInterviewTtsQuiescentBeforeEmotionModal: webTts.waitForWebInterviewTtsQuiescentBeforeEmotionModal,
      waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal:
        webTts.waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal,
    },
  };
}
