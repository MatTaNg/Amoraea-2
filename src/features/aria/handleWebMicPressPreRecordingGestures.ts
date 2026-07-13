import { Platform } from 'react-native';

import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  findLastRepeatableInterviewQuestionText,
  resolveInterviewQuestionRepeatTtsText,
} from '@features/aria/interviewDisengagementProbes';
import {
  clearPendingWebSpeechGesturePair,
  peekPendingWebSpeechGesture,
} from '@features/aria/interviewWebPendingSpeechGesture';
import { scenarioAContemptProbeResumeRepeatTtsText } from '@features/aria/scenarioAContemptProbeLogic';
import type { HandleNativeOrWhisperMicPressDeps } from '@features/aria/handleNativeOrWhisperMicPressTypes';
import { fetchElevenLabsMpegArrayBuffer } from '@features/aria/utils/elevenLabsTtsFetch';
import { primeHtmlAudioForMobileTtsFromMicGesture } from '@features/aria/utils/webInterviewSharedHtmlAudio';
import { tryPlayPendingWebTtsAudioInUserGesture } from '@features/aria/utils/webInterviewPendingGestureBlobPlayback';
import { trySpeakWebSpeechInUserGesture } from '@features/aria/utils/interviewWebSpeechSynthesis';
import { unlockWebAudioForAutoplay } from '@features/aria/utils/webInterviewTtsDocumentLifecycle';
import { preAuthorizeAudioElementOnMicTapGesture } from '@features/aria/utils/webPreAuthorizedTtsAudio';
import { markWebInterviewUserGestureNow } from '@features/aria/utils/webInterviewGestureContext';

export type WebMicPressPreRecordingResult = 'continue' | 'handled';

export async function handleWebMicPressPreRecordingGestures(
  deps: HandleNativeOrWhisperMicPressDeps,
): Promise<WebMicPressPreRecordingResult> {
  const {
    voiceState,
    useTapMicUi,
    useMediaRecorderPath,
    audioRecorder,
    touchActivity,
    setSessionAudioHealthNotice,
    setConversationErrorNotice,
    resumeRepeatChoicePendingRef,
    currentMessagesRef,
    currentScenarioRef,
    resumeLastAssistantTextRef,
    lastQuestionTextRef,
    handleRecordingError,
    isInterviewerOutputActiveForMicGate,
    voiceStateRef,
    setVoiceState,
    mobileTabHideLetPlaybackContinueRef,
    webMicArmInFlightRef,
    webTabGestureRestoreOverlayRef,
    webTtsTabInterruptPendingReplayRef,
    webTabRestoreReplayInFlightRef,
    pendingGestureRestoreSpeakRef,
    handleWebTabGestureRestoreTapRef,
    setWebTabGestureRestoreOverlay,
    ensureWebGestureFlushListener,
    pendingMicStartAfterIdleFlushRef,
    startRecordingAfterPendingTts,
    pendingWebSpeechForGestureRef,
    webGestureTtsConsumedPressRef,
    webGestureConsumeClearTimeoutRef,
    handlePressEnd,
    handlePressStart,
    isWebInterviewPlaybackAudiblyActive,
  } = deps;

  touchActivity();
  setSessionAudioHealthNotice(null);
  setConversationErrorNotice?.(null);
  if (Platform.OS === 'web') {
    markWebInterviewUserGestureNow();
    unlockWebAudioForAutoplay();
    primeHtmlAudioForMobileTtsFromMicGesture();
    preAuthorizeAudioElementOnMicTapGesture();
  }
  if (!useTapMicUi) return 'handled';

  if (useMediaRecorderPath && audioRecorder.isRecording) {
    if (__DEV__) console.log('[Amoraea] MIC PRESSED, isRecording: true → stop priority');
    if (Platform.OS === 'web') {
      preAuthorizeAudioElementOnMicTapGesture();
      if (resumeRepeatChoicePendingRef.current) {
        const prefetchText = resolveInterviewQuestionRepeatTtsText(
          scenarioAContemptProbeResumeRepeatTtsText(
            stripControlTokens(
        findLastRepeatableInterviewQuestionText(
                currentMessagesRef.current,
                resumeLastAssistantTextRef.current ?? lastQuestionTextRef.current,
                { activeScenario: currentScenarioRef.current },
              ),
            ).trim(),
          ),
        );
        if (prefetchText.length > 0) {
          void fetchElevenLabsMpegArrayBuffer(prefetchText).then((buffer) => {
            if (buffer && buffer.byteLength > 0) {
              deps.resumeRepeatPrefetchMpegRef.current = { text: prefetchText, buffer };
            }
          });
        }
      }
    }
    try {
      await audioRecorder.stopRecording();
      if (__DEV__) console.log('[Amoraea] RECORDING STOPPED (priority)');
    } catch (err) {
      if (__DEV__) console.error('[Amoraea] MIC ERROR:', err instanceof Error ? err.message : err);
      handleRecordingError(err instanceof Error ? err : new Error(String(err)));
    }
    return 'handled';
  }

  if (isInterviewerOutputActiveForMicGate()) {
    if (Platform.OS === 'web' && voiceStateRef.current === 'idle') {
      setVoiceState('speaking');
    }
    return 'handled';
  }
  if (Platform.OS === 'web' && mobileTabHideLetPlaybackContinueRef.current) {
    if (isWebInterviewPlaybackAudiblyActive() && voiceStateRef.current === 'idle') {
      setVoiceState('speaking');
    }
    return 'handled';
  }
  if (Platform.OS === 'web' && voiceStateRef.current === 'speaking') {
    setVoiceState('idle');
  }
  if (Platform.OS === 'web' && webMicArmInFlightRef.current) return 'handled';
  if (Platform.OS === 'web' && webTabGestureRestoreOverlayRef.current) {
    handleWebTabGestureRestoreTapRef.current();
    return 'handled';
  }
  if (
    Platform.OS === 'web' &&
    webTtsTabInterruptPendingReplayRef.current &&
    !webTabRestoreReplayInFlightRef.current
  ) {
    if (pendingGestureRestoreSpeakRef.current) {
      handleWebTabGestureRestoreTapRef.current();
    } else {
      setWebTabGestureRestoreOverlay(true);
      ensureWebGestureFlushListener();
    }
    return 'handled';
  }
  if (Platform.OS === 'web' && voiceState === 'idle' && !audioRecorder.isRecording) {
    pendingMicStartAfterIdleFlushRef.current = true;
  } else {
    pendingMicStartAfterIdleFlushRef.current = false;
  }
  if (Platform.OS === 'web') {
    if (pendingGestureRestoreSpeakRef.current) {
      handleWebTabGestureRestoreTapRef.current();
      return 'handled';
    }
    const tryPlayed = await tryPlayPendingWebTtsAudioInUserGesture(
      () => {
        const shouldStartMic = pendingMicStartAfterIdleFlushRef.current;
        pendingMicStartAfterIdleFlushRef.current = false;
        if (shouldStartMic) void startRecordingAfterPendingTts();
      },
      () => clearPendingWebSpeechGesturePair(pendingWebSpeechForGestureRef),
      { source: 'turn' },
    );
    if (tryPlayed) {
      if (pendingGestureRestoreSpeakRef.current || webTtsTabInterruptPendingReplayRef.current) {
        handleWebTabGestureRestoreTapRef.current();
      }
      return 'handled';
    }
  }
  if (Platform.OS === 'web' && webGestureTtsConsumedPressRef.current) {
    pendingMicStartAfterIdleFlushRef.current = false;
    webGestureTtsConsumedPressRef.current = false;
    if (webGestureConsumeClearTimeoutRef.current) {
      clearTimeout(webGestureConsumeClearTimeoutRef.current);
      webGestureConsumeClearTimeoutRef.current = null;
    }
    return 'handled';
  }
  if (Platform.OS === 'web') {
    const t = peekPendingWebSpeechGesture(pendingWebSpeechForGestureRef);
    if (t) {
      const shouldStartMic = pendingMicStartAfterIdleFlushRef.current;
      pendingMicStartAfterIdleFlushRef.current = false;
      clearPendingWebSpeechGesturePair(pendingWebSpeechForGestureRef);
      webGestureTtsConsumedPressRef.current = true;
      if (webGestureConsumeClearTimeoutRef.current) {
        clearTimeout(webGestureConsumeClearTimeoutRef.current);
        webGestureConsumeClearTimeoutRef.current = null;
      }
      webGestureConsumeClearTimeoutRef.current = setTimeout(() => {
        webGestureConsumeClearTimeoutRef.current = null;
        webGestureTtsConsumedPressRef.current = false;
      }, 1800);
      trySpeakWebSpeechInUserGesture(t, () => {
        if (shouldStartMic) void startRecordingAfterPendingTts();
      });
      return 'handled';
    }
  }
  if (Platform.OS === 'web') {
    pendingMicStartAfterIdleFlushRef.current = false;
  }
  if (Platform.OS === 'web' && !useMediaRecorderPath) {
    if (voiceState === 'listening') {
      await handlePressEnd();
      return 'handled';
    }
    if (voiceState === 'speaking' && !isInterviewerOutputActiveForMicGate()) {
      setVoiceState('idle');
    }
    if (voiceState === 'idle') {
      await handlePressStart();
      return 'handled';
    }
    return 'handled';
  }
  return 'continue';
}
