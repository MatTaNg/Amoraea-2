import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';

import { getAudioRouteKind } from '@features/aria/config/audioRouteRuntime';
import { getLateStartThresholdMs } from '@features/aria/config/audioInterviewConfig';
import { isNamePromptInterviewMoment } from '@features/aria/interviewLanguageGate';
import {
  clearPendingWebSpeechGesturePair,
  peekPendingWebSpeechGesture,
} from '@features/aria/interviewWebPendingSpeechGesture';
import { recordingDelayMsFromRef } from '@features/aria/interviewMicAndRecordingHelpers';
import { stopElevenLabsPlayback, stopElevenLabsSpeech } from '@features/aria/utils/elevenLabsTtsPlaybackStop';
import { isWebInterviewPlaybackSurfaceActive } from '@features/aria/utils/webInterviewPlaybackSurface';
import { trySpeakWebSpeechInUserGesture } from '@features/aria/utils/interviewWebSpeechSynthesis';
import type { HeadphoneProbeResult } from '@features/aria/utils/audioRouteHeadphones';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import {
  isWebInterviewMicPreInitReady,
  rearmWebMicPreInitAfterRecordingStop,
  rearmWebMicPreInitAfterTtsPlaybackComplete,
  refreshWebMicPreInitIfStaleAfterLateStartWindow,
  webMicPreInitNeedsRefreshForNameEntry,
} from '@features/aria/utils/webInterviewMicPreInit';
import {
  getAudioCorrelationFields,
  getLastTtsCompletionCallbackMs,
  markLastAudioSessionEventType,
  peekRecordingDelayExtraFromEarlyCutoffMs,
  takeRecordingDelayExtraFromEarlyCutoffMs,
  writeAudioSessionLog,
} from '@utilities/sessionLogging/audioSessionLogEnvelope';
import { getSessionLogRuntime } from '@utilities/sessionLogging/sessionLogContext';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';
export type WebMicPressLifecycleDeps = {
  userId: string | undefined;
  voiceState: VoiceState;
  voiceStateRef: MutableRefObject<VoiceState>;
  useMediaRecorderPath: boolean;
  currentTranscript: string;
  audioRecorder: {
    isRecording: boolean;
    startRecording: (opts?: {
      postAudioSessionDelayMs?: number;
      tapIntentAtMs?: number;
    }) => Promise<boolean | void>;
  };
  setVoiceState: React.Dispatch<React.SetStateAction<VoiceState>>;
  setMicWarning: React.Dispatch<React.SetStateAction<string | null>>;
  setMicEnginePrimed: (v: boolean) => void;
  setMicPermission: React.Dispatch<React.SetStateAction<'granted' | 'denied' | 'prompt' | 'unavailable'>>;
  setCurrentTranscript: React.Dispatch<React.SetStateAction<string>>;
  stopElevenLabsPlayback: () => Promise<void>;
  stopElevenLabsSpeech: () => void;
  checkMicPermission: () => Promise<'granted' | 'denied' | 'prompt' | 'unavailable'>;
  isInterviewerOutputActiveForMicGate: () => boolean;
  isWebInterviewPlaybackSurfaceActive: () => boolean;
  webSpeechShouldDeferToUserGesture: () => boolean;
  handleRecordingError: (err: Error) => void;
  processUserSpeech: (spokenText: string) => void | Promise<void>;
  takeRecordingStartEventDataWithVadBypassRestart: () => Record<string, unknown>;
  pendingWebSpeechForGestureRef: MutableRefObject<string | null>;
  transcriptAtReleaseRef: MutableRefObject<string>;
  timingRef: MutableRefObject<{
    questionEndTime: number | null;
    recordingStartTime: number | null;
    recordingEndTime: number | null;
  }>;
  recognitionRef: MutableRefObject<{ start: () => void; stop: () => void } | null>;
  ttsLineInFlightRef: MutableRefObject<boolean>;
  webMicArmInFlightRef: MutableRefObject<boolean>;
  micTapWhileTtsActiveRef: MutableRefObject<boolean>;
  interviewNameRef: MutableRefObject<string | null>;
  interviewNameReaskPendingRef: MutableRefObject<boolean>;
  lastQuestionTextRef: MutableRefObject<string | null>;
  lastHeadphoneProbeRef: MutableRefObject<HeadphoneProbeResult | null>;
  lastAudioRouteFingerprintRef: MutableRefObject<string | null>;
  currentInterviewMomentRef: MutableRefObject<number>;
  currentScenarioRef: MutableRefObject<number | null>;
  recordingDelayMeasurementRef: MutableRefObject<{
    modeCompleteAtMs: number;
    recordingInitializedAtMs: number;
  } | null>;
};

export async function runWaitUntilInterviewerQuiescentForWebMic(
  deps: WebMicPressLifecycleDeps,
): Promise<void> {
  const { ttsLineInFlightRef } = deps;
  if (Platform.OS !== 'web') return;
  await stopElevenLabsPlayback();
  const quiesceStartMs = Date.now();
  const maxMs = 450;
  while (Date.now() - quiesceStartMs < maxMs) {
    const rt = getSessionLogRuntime();
    const ttsIdle = !ttsLineInFlightRef.current && !rt.ttsPlaybackActive;
    const surfacesClear = !isWebInterviewPlaybackSurfaceActive();
    if (ttsIdle && surfacesClear) break;
    await new Promise<void>((r) => setTimeout(r, 25));
  }
}

export async function runStartRecordingAfterPendingTts(
  deps: WebMicPressLifecycleDeps,
): Promise<void> {
  const {
    userId,
    voiceStateRef,
    audioRecorder,
    webMicArmInFlightRef,
    micTapWhileTtsActiveRef,
    setMicEnginePrimed,
    interviewNameRef,
    interviewNameReaskPendingRef,
    lastQuestionTextRef,
    setVoiceState,
    recordingDelayMeasurementRef,
    lastHeadphoneProbeRef,
    lastAudioRouteFingerprintRef,
    currentInterviewMomentRef,
    currentScenarioRef,
    handleRecordingError,
    isInterviewerOutputActiveForMicGate,
    webSpeechShouldDeferToUserGesture,
    takeRecordingStartEventDataWithVadBypassRestart,
    ttsLineInFlightRef,
  } = deps;
  if (Platform.OS !== 'web') return;
  if (voiceStateRef.current === 'processing') return;
  if (
    voiceStateRef.current !== 'idle' &&
    (Platform.OS !== 'web' || isInterviewerOutputActiveForMicGate())
  ) {
    return;
  }
  if (audioRecorder.isRecording) return;
  if (webMicArmInFlightRef.current) return;
  webMicArmInFlightRef.current = true;
  try {
    if (userId && getSessionLogRuntime().ttsPlaybackActive) {
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'tts_interrupted',
        eventData: { source: 'start_recording_after_pending_tts' },
        platform: r.platform,
      });
    }
    const tapIntentAtMs = Date.now();
    micTapWhileTtsActiveRef.current =
      getSessionLogRuntime().ttsPlaybackActive || ttsLineInFlightRef.current;
    setMicEnginePrimed(false);
    const nameEntryTurn =
      !interviewNameRef.current &&
      (interviewNameReaskPendingRef.current ||
        isNamePromptInterviewMoment(lastQuestionTextRef.current));
    await runWaitUntilInterviewerQuiescentForWebMic(deps);
    if (Platform.OS === 'web' && !isWebInterviewMicPreInitReady()) {
      await rearmWebMicPreInitAfterTtsPlaybackComplete();
    } else if (nameEntryTurn && webMicPreInitNeedsRefreshForNameEntry()) {
      await rearmWebMicPreInitAfterRecordingStop();
    }
    setVoiceState('recording');
    const intendedDelayMs =
      Platform.OS === 'web' ? 0 : 500 + peekRecordingDelayExtraFromEarlyCutoffMs();
    const extraDelayMs = takeRecordingDelayExtraFromEarlyCutoffMs();
    recordingDelayMeasurementRef.current = null;
    await audioRecorder.startRecording({
      postAudioSessionDelayMs: Platform.OS === 'web' ? 0 : 500 + extraDelayMs,
      tapIntentAtMs,
    });
    if (!audioRecorder.isRecording) {
      setVoiceState('idle');
      setMicEnginePrimed(false);
      return;
    }
    const actualDelayMs = recordingDelayMsFromRef(recordingDelayMeasurementRef, tapIntentAtMs);
    if (userId) {
      const r = getSessionLogRuntime();
      const corr = getAudioCorrelationFields();
      const probeSnapshot: HeadphoneProbeResult =
        lastHeadphoneProbeRef.current ?? {
          input: null,
          fingerprint: lastAudioRouteFingerprintRef.current,
          kind: getAudioRouteKind(),
          shouldShowHeadphonePrompt: false,
        };
      const btHint =
        probeSnapshot.input?.name && /bluetooth|airpod|wireless|buds/i.test(probeSnapshot.input.name)
          ? probeSnapshot.input.name.slice(0, 120)
          : null;
      markLastAudioSessionEventType('recording_delay_observed');
      writeAudioSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'recording_delay_observed',
        eventData: {
          intended_delay_ms: intendedDelayMs,
          actual_delay_ms: actualDelayMs,
          moment_number: currentInterviewMomentRef.current,
          scenario_number: currentScenarioRef.current,
        },
        platform: r.platform,
      });
      markLastAudioSessionEventType('audio_route_at_recording_start');
      writeAudioSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'audio_route_at_recording_start',
        eventData: {
          input_route: corr.input_route,
          output_route: corr.output_route,
          audio_output_route: corr.audio_output_route,
          headphones_connected: corr.headphones_connected,
          audio_devices_enumerated_json: corr.audio_devices_enumerated_json,
          bluetooth_device_name: btHint,
          moment_number: currentInterviewMomentRef.current,
        },
        platform: r.platform,
      });
      markLastAudioSessionEventType('recording_quality_actual');
      writeAudioSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'recording_quality_actual',
        eventData: {
          sample_rate_requested: 48000,
          sample_rate_actual: 48000,
          bit_depth_actual: 16,
          channels_actual: 1,
          moment_number: currentInterviewMomentRef.current,
          sample_rate_below_requested: false,
        },
        platform: r.platform,
      });
      const ttsDone = getLastTtsCompletionCallbackMs();
      const sinceTts = ttsDone != null ? tapIntentAtMs - ttsDone : null;
      const lateTh = getLateStartThresholdMs();
      markLastAudioSessionEventType('user_speech_latency');
      writeAudioSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'user_speech_latency',
        eventData: {
          time_since_tts_completion_ms: sinceTts,
          moment_number: currentInterviewMomentRef.current,
          early_start: sinceTts != null && sinceTts < 800,
          late_start: sinceTts != null && sinceTts > lateTh,
          late_start_threshold_ms: lateTh,
        },
        platform: r.platform,
      });
      if (userId && sinceTts != null && sinceTts > lateTh && !webSpeechShouldDeferToUserGesture()) {
        writeAudioSessionLog({
          userId,
          attemptId: r.attemptId,
          eventType: 'late_start_extended',
          eventData: {
            time_since_tts_completion_ms: sinceTts,
            late_start_threshold_ms: lateTh,
            moment_number: currentInterviewMomentRef.current,
          },
          platform: r.platform,
        });
        void refreshWebMicPreInitIfStaleAfterLateStartWindow();
      }
      markLastAudioSessionEventType('recording_start');
      writeSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'recording_start',
        eventData: takeRecordingStartEventDataWithVadBypassRestart(),
        platform: r.platform,
      });
    }
  } catch (err) {
    handleRecordingError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    webMicArmInFlightRef.current = false;
  }
}

export async function runHandlePressStart(deps: WebMicPressLifecycleDeps): Promise<void> {
  const {
    voiceState,
    useMediaRecorderPath,
    pendingWebSpeechForGestureRef,
    isInterviewerOutputActiveForMicGate,
    setVoiceState,
    setMicWarning,
    setCurrentTranscript,
    transcriptAtReleaseRef,
    setMicPermission,
    timingRef,
    recognitionRef,
    checkMicPermission,
  } = deps;
  if (Platform.OS === 'web') {
    const t = peekPendingWebSpeechGesture(pendingWebSpeechForGestureRef);
    if (t) {
      clearPendingWebSpeechGesturePair(pendingWebSpeechForGestureRef);
      trySpeakWebSpeechInUserGesture(t, () => {});
      return;
    }
  }
  if (Platform.OS === 'web' && voiceState === 'speaking' && !isInterviewerOutputActiveForMicGate()) {
    setVoiceState('idle');
  } else if (voiceState !== 'idle') return;
  if (useMediaRecorderPath) return;
  setMicWarning(null);
  stopElevenLabsSpeech();
  setCurrentTranscript('');
  transcriptAtReleaseRef.current = '';
  const permission = await checkMicPermission();
  setMicPermission(permission);
  if (permission === 'denied') return;
  timingRef.current.recordingStartTime = Date.now();
  setVoiceState('listening');
  if (Platform.OS === 'web' && recognitionRef.current) {
    try {
      recognitionRef.current.start();
    } catch {
      /* ignore */
    }
  }
}

export async function runHandlePressEnd(deps: WebMicPressLifecycleDeps): Promise<void> {
  const {
    voiceState,
    useMediaRecorderPath,
    recognitionRef,
    setVoiceState,
    transcriptAtReleaseRef,
    currentTranscript,
    processUserSpeech,
  } = deps;
  if (voiceState !== 'listening') return;
  if (useMediaRecorderPath) return;
  if (Platform.OS === 'web' && recognitionRef.current) {
    recognitionRef.current.stop();
  }
  setVoiceState('processing');
  setTimeout(() => {
    const text = transcriptAtReleaseRef.current?.trim() ?? currentTranscript.trim();
    processUserSpeech(text);
  }, 400);
}
