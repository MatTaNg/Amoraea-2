import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';

import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  findLastRepeatableInterviewQuestionText,
  resolveInterviewQuestionRepeatTtsText,
} from '@features/aria/interviewDisengagementProbes';
import { isNamePromptInterviewMoment } from '@features/aria/interviewLanguageGate';
import { handleWebMicPressPreRecordingGestures } from '@features/aria/handleWebMicPressPreRecordingGestures';
import { logMicRecordingStartTelemetry } from '@features/aria/logMicRecordingStartTelemetry';
import { scenarioAContemptProbeResumeRepeatTtsText } from '@features/aria/scenarioAContemptProbeLogic';
import type { HeadphoneProbeResult } from '@features/aria/utils/audioRouteHeadphones';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import { fetchElevenLabsMpegArrayBuffer } from '@features/aria/utils/elevenLabsTtsFetch';
import {
  isWebInterviewMicPreInitReady,
  rearmWebMicPreInitAfterRecordingStop,
  rearmWebMicPreInitAfterTtsPlaybackComplete,
  webMicPreInitNeedsRefreshForNameEntry,
} from '@features/aria/utils/webInterviewMicPreInit';
import {
  peekRecordingDelayExtraFromEarlyCutoffMs,
  takeRecordingDelayExtraFromEarlyCutoffMs,
} from '@utilities/sessionLogging/audioSessionLogEnvelope';
import { getSessionLogRuntime } from '@utilities/sessionLogging/sessionLogContext';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

export type HandleNativeOrWhisperMicPressDeps = {
  userId: string | undefined;
  voiceState: VoiceState;
  useTapMicUi: boolean;
  useMediaRecorderPath: boolean;
  audioRecorder: {
    isRecording: boolean;
    stopRecording: (opts?: { bypassMinDuration?: boolean }) => void | Promise<void>;
    startRecording: (opts?: {
      postAudioSessionDelayMs?: number;
      tapIntentAtMs?: number;
    }) => Promise<boolean | void>;
  };
  touchActivity: () => void;
  setSessionAudioHealthNotice: React.Dispatch<React.SetStateAction<string | null>>;
  setConversationErrorNotice?: React.Dispatch<React.SetStateAction<string | null>>;
  resumeRepeatChoicePendingRef: MutableRefObject<boolean>;
  currentMessagesRef: MutableRefObject<{ role: string; content: string; [key: string]: unknown }[]>;
  resumeLastAssistantTextRef: MutableRefObject<string | null>;
  lastQuestionTextRef: MutableRefObject<string | null>;
  handleRecordingError: (err: Error) => void;
  isInterviewerOutputActiveForMicGate: () => boolean;
  voiceStateRef: MutableRefObject<VoiceState>;
  setVoiceState: React.Dispatch<React.SetStateAction<VoiceState>>;
  mobileTabHideLetPlaybackContinueRef: MutableRefObject<boolean>;
  webMicArmInFlightRef: MutableRefObject<boolean>;
  webTabGestureRestoreOverlayRef: MutableRefObject<boolean>;
  webTtsTabInterruptPendingReplayRef: MutableRefObject<boolean>;
  webTabRestoreReplayInFlightRef: MutableRefObject<boolean>;
  pendingGestureRestoreSpeakRef: MutableRefObject<unknown>;
  handleWebTabGestureRestoreTapRef: MutableRefObject<() => void>;
  setWebTabGestureRestoreOverlay: (v: boolean) => void;
  ensureWebGestureFlushListener: () => void;
  pendingMicStartAfterIdleFlushRef: MutableRefObject<boolean>;
  startRecordingAfterPendingTts: () => Promise<void>;
  pendingWebSpeechForGestureRef: MutableRefObject<string | null>;
  webGestureTtsConsumedPressRef: MutableRefObject<boolean>;
  webGestureConsumeClearTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  handlePressEnd: () => Promise<void>;
  handlePressStart: () => Promise<void>;
  waitUntilInterviewerQuiescentForWebMic: () => Promise<void>;
  ttsLineInFlightRef: MutableRefObject<boolean>;
  interviewNameRef: MutableRefObject<string | null>;
  interviewNameReaskPendingRef: MutableRefObject<boolean>;
  micTapWhileTtsActiveRef: MutableRefObject<boolean>;
  setMicEnginePrimed: (v: boolean) => void;
  recordingDelayMeasurementRef: MutableRefObject<{
    modeCompleteAtMs: number;
    recordingInitializedAtMs: number;
  } | null>;
  lastHeadphoneProbeRef: MutableRefObject<HeadphoneProbeResult | null>;
  lastAudioRouteFingerprintRef: MutableRefObject<string | null>;
  currentInterviewMomentRef: MutableRefObject<number>;
  currentScenarioRef: MutableRefObject<number | null>;
  resumeRepeatPrefetchMpegRef: MutableRefObject<{ text: string; buffer: ArrayBuffer } | null>;
  takeRecordingStartEventDataWithVadBypassRestart: () => Record<string, unknown>;
  isWebInterviewPlaybackAudiblyActive: () => boolean;
  webSpeechShouldDeferToUserGesture: () => boolean;
};

export async function runHandleNativeOrWhisperMicPress(
  deps: HandleNativeOrWhisperMicPressDeps,
): Promise<void> {
  const {
    userId,
    useMediaRecorderPath,
    audioRecorder,
    handleRecordingError,
    isInterviewerOutputActiveForMicGate,
    voiceStateRef,
    setVoiceState,
    webMicArmInFlightRef,
    resumeRepeatChoicePendingRef,
    currentMessagesRef,
    currentScenarioRef,
    resumeLastAssistantTextRef,
    lastQuestionTextRef,
    resumeRepeatPrefetchMpegRef,
    waitUntilInterviewerQuiescentForWebMic,
    interviewNameRef,
    interviewNameReaskPendingRef,
    micTapWhileTtsActiveRef,
    setMicEnginePrimed,
    recordingDelayMeasurementRef,
    ttsLineInFlightRef,
  } = deps;

  const preRecording = await handleWebMicPressPreRecordingGestures(deps);
  if (preRecording === 'handled') {
    return;
  }

  if (__DEV__) console.log('[Amoraea] MIC PRESSED, isRecording:', audioRecorder.isRecording);
  try {
    if (audioRecorder.isRecording) {
      await audioRecorder.stopRecording();
      if (__DEV__) console.log('[Amoraea] RECORDING STOPPED');
    } else {
      if (Platform.OS === 'web') {
        webMicArmInFlightRef.current = true;
      }
      const tapIntentAtMs = Date.now();
      micTapWhileTtsActiveRef.current =
        getSessionLogRuntime().ttsPlaybackActive || ttsLineInFlightRef.current;
      setMicEnginePrimed(false);
      if (Platform.OS === 'web') {
        if (userId && getSessionLogRuntime().ttsPlaybackActive) {
          const r = getSessionLogRuntime();
          writeSessionLog({
            userId,
            attemptId: r.attemptId,
            eventType: 'tts_interrupted',
            eventData: { source: 'mic_press_before_recording' },
            platform: r.platform,
          });
        }
        const nameEntryTurn =
          !interviewNameRef.current &&
          (interviewNameReaskPendingRef.current ||
            isNamePromptInterviewMoment(lastQuestionTextRef.current));
        await waitUntilInterviewerQuiescentForWebMic();
        if (Platform.OS === 'web' && !isWebInterviewMicPreInitReady()) {
          await rearmWebMicPreInitAfterTtsPlaybackComplete();
        } else if (nameEntryTurn && webMicPreInitNeedsRefreshForNameEntry()) {
          await rearmWebMicPreInitAfterRecordingStop();
        }
      }
      setVoiceState('recording');
      const intendedDelayMs =
        Platform.OS === 'web' ? 0 : 500 + peekRecordingDelayExtraFromEarlyCutoffMs();
      const extraDelayMs = takeRecordingDelayExtraFromEarlyCutoffMs();
      recordingDelayMeasurementRef.current = null;
      if (Platform.OS === 'web' && resumeRepeatChoicePendingRef.current) {
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
              resumeRepeatPrefetchMpegRef.current = { text: prefetchText, buffer };
            }
          });
        }
      }
      await audioRecorder.startRecording({
        postAudioSessionDelayMs: Platform.OS === 'web' ? 0 : 500 + extraDelayMs,
        tapIntentAtMs,
      });
      if (!audioRecorder.isRecording) {
        setVoiceState('idle');
        setMicEnginePrimed(false);
        return;
      }
      logMicRecordingStartTelemetry(deps, tapIntentAtMs, intendedDelayMs);
      if (__DEV__) console.log('[Amoraea] RECORDING STARTED');
    }
  } catch (err) {
    if (__DEV__) console.error('[Amoraea] MIC ERROR:', err instanceof Error ? err.message : err);
    handleRecordingError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    if (Platform.OS === 'web') {
      webMicArmInFlightRef.current = false;
    }
  }
}
