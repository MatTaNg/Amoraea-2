import type { MutableRefObject } from 'react';

import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';
import type { AriaInterviewWebTtsPreCoreDepSyncWiringParams } from '@features/aria/hooks/useAriaInterviewWebTtsPreCoreDepSyncWiring';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';

export type BuildAriaInterviewWebTtsPreCoreDepSyncWiringParamsFromScreenInput = {
  session: AriaInterviewScreenSessionState;
  userIdRef: MutableRefObject<string>;
  boot: {
    applyInterviewSpeechComplete: AriaInterviewWebTtsPreCoreDepSyncWiringParams['webTabRestore']['applyInterviewSpeechComplete'];
  };
  interviewSession: {
    awaitTtsScreenReadyGate: AriaInterviewWebTtsPreCoreDepSyncWiringParams['ttsSpeak']['awaitTtsScreenReadyGate'];
    setVoiceState: AriaInterviewWebTtsPreCoreDepSyncWiringParams['ttsSpeak']['setVoiceState'];
    isSpeakingRef: MutableRefObject<unknown>;
    pendingGestureRestoreSpeakRef: MutableRefObject<unknown>;
    webTabGestureRestoreOverlayRef: MutableRefObject<unknown>;
    webGestureFlushListenerAttachedRef: MutableRefObject<unknown>;
    webGestureFlushHandlerRef: MutableRefObject<unknown>;
    webGestureTtsConsumedPressRef: MutableRefObject<unknown>;
    webGestureConsumeClearTimeoutRef: MutableRefObject<unknown>;
    pendingWebSpeechForGestureRef: MutableRefObject<unknown>;
    setMobileWebTapToBeginDone: (value: boolean) => void;
    setWebDesktopPendingTtsGestureOverlay: (value: boolean) => void;
    setWebTabRestoreOverlayVisible: (value: boolean) => void;
    tabVisibilityGestureLossPendingRef: MutableRefObject<unknown>;
    needsGestureRestoreRef: MutableRefObject<unknown>;
  };
};

/** Assemble web TTS pre-core dep-sync params from session state + boot speech-complete callback. */
export function buildAriaInterviewWebTtsPreCoreDepSyncWiringParamsFromScreen(
  input: BuildAriaInterviewWebTtsPreCoreDepSyncWiringParamsFromScreenInput,
): AriaInterviewWebTtsPreCoreDepSyncWiringParams {
  const { session, userIdRef, boot, interviewSession } = input;
  const { shell, gate } = session;
  const {
    lastQuestionTextRef,
    timingRef,
    handleWebTabGestureRestoreTapRef,
    mobileTabHideLetPlaybackContinueRef,
    recordingJustFinishedBeforeNextTtsRef,
    tabHiddenDuringActiveTtsLineRef,
    mobileTabHideBackgroundUtteranceRef,
  } = shell;
  const {
    webTtsTabInterruptPendingReplayRef,
    webTabRestoreReplayInFlightRef,
    webTabRestoreDeliveredNormRef,
    webTtsUtteranceInFlightRef,
    lastSuccessfulTtsTextNormalizedRef,
  } = gate.webTts;
  const { webResumeWelcomeTapPendingRef } = gate.resumeEmotion;
  const {
    awaitTtsScreenReadyGate,
    setVoiceState,
    isSpeakingRef,
    pendingGestureRestoreSpeakRef,
    webTabGestureRestoreOverlayRef,
    webGestureFlushListenerAttachedRef,
    webGestureFlushHandlerRef,
    webGestureTtsConsumedPressRef,
    webGestureConsumeClearTimeoutRef,
    pendingWebSpeechForGestureRef,
    setMobileWebTapToBeginDone,
    setWebDesktopPendingTtsGestureOverlay,
    setWebTabRestoreOverlayVisible,
    tabVisibilityGestureLossPendingRef,
    needsGestureRestoreRef,
  } = interviewSession;

  return {
    ttsSpeak: {
      awaitTtsScreenReadyGate,
      setVoiceState,
      userIdRef,
      lastQuestionTextRef,
      isSpeakingRef,
      timingRef,
      recordingJustFinishedBeforeNextTtsRef,
      trySplitFictionalScenarioIntroLongDelivery: preamble.trySplitFictionalScenarioIntroLongDelivery,
    },
    webTtsGesture: {
      webResumeWelcomeTapPendingRef,
      webTabRestoreReplayInFlightRef,
      pendingGestureRestoreSpeakRef,
      webTabGestureRestoreOverlayRef,
      webGestureFlushListenerAttachedRef,
      webGestureFlushHandlerRef,
      webGestureTtsConsumedPressRef,
      webGestureConsumeClearTimeoutRef,
      pendingWebSpeechForGestureRef,
      webTtsTabInterruptPendingReplayRef,
      handleWebTabGestureRestoreTapRef,
      setMobileWebTapToBeginDone,
      setWebDesktopPendingTtsGestureOverlay,
      setVoiceState,
    },
    webTabRestore: {
      setWebTabRestoreOverlayVisible,
      pendingGestureRestoreSpeakRef,
      webTtsTabInterruptPendingReplayRef,
      tabHiddenDuringActiveTtsLineRef,
      tabVisibilityGestureLossPendingRef,
      needsGestureRestoreRef,
      webTabRestoreReplayInFlightRef,
      webTabRestoreDeliveredNormRef,
      mobileTabHideLetPlaybackContinueRef,
      mobileTabHideBackgroundUtteranceRef,
      webTtsUtteranceInFlightRef,
      lastQuestionTextRef,
      lastSuccessfulTtsTextNormalizedRef,
      applyInterviewSpeechComplete: boot.applyInterviewSpeechComplete,
    },
  };
}
