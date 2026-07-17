import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';

import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { getAudioPostSessionRecordingDelayMs } from '@features/aria/config/audioInterviewConfig';
import {
  findLastRepeatableInterviewQuestionText,
  resolveInterviewQuestionRepeatTtsText,
} from '@features/aria/interviewDisengagementProbes';
import { withRepeatRequestAcknowledgment } from '@features/aria/interviewRepeatRequestTarget';
import { logMicRecordingStartTelemetry } from '@features/aria/logMicRecordingStartTelemetry';
import { scenarioAContemptProbeResumeRepeatTtsText } from '@features/aria/scenarioAContemptProbeLogic';
import type { HeadphoneProbeResult } from '@features/aria/utils/audioRouteHeadphones';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import { fetchElevenLabsMpegArrayBuffer } from '@features/aria/utils/elevenLabsTtsFetch';
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
  webMicArmInFlightRef: MutableRefObject<boolean>;
  startRecordingAfterPendingTts: () => Promise<void>;
  handlePressEnd: () => Promise<void>;
  handlePressStart: () => Promise<void>;
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
};

export async function runHandleNativeOrWhisperMicPress(
  deps: HandleNativeOrWhisperMicPressDeps,
): Promise<void> {
  const {
    userId,
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
    micTapWhileTtsActiveRef,
    setMicEnginePrimed,
    recordingDelayMeasurementRef,
    ttsLineInFlightRef,
  } = deps;

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
      }
      setVoiceState('recording');
      const baseDelayMs = Platform.OS === 'web' ? 0 : getAudioPostSessionRecordingDelayMs();
      const intendedDelayMs = baseDelayMs + peekRecordingDelayExtraFromEarlyCutoffMs();
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
          const prefetchSpoken = withRepeatRequestAcknowledgment(prefetchText);
          void fetchElevenLabsMpegArrayBuffer(prefetchSpoken).then((buffer) => {
            if (buffer && buffer.byteLength > 0) {
              resumeRepeatPrefetchMpegRef.current = { text: prefetchSpoken, buffer };
            }
          });
        }
      }
      await audioRecorder.startRecording({
        postAudioSessionDelayMs: baseDelayMs + extraDelayMs,
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
