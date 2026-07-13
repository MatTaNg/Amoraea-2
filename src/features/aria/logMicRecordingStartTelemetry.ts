import { Platform } from 'react-native';

import type { HandleNativeOrWhisperMicPressDeps } from '@features/aria/handleNativeOrWhisperMicPressTypes';
import { recordingDelayMsFromRef } from '@features/aria/interviewMicAndRecordingHelpers';
import { getAudioRouteKind } from '@features/aria/config/audioRouteRuntime';
import type { HeadphoneProbeResult } from '@features/aria/utils/audioRouteHeadphones';
import { getLateStartThresholdMs } from '@features/aria/config/audioInterviewConfig';
import { refreshWebMicPreInitIfStaleAfterLateStartWindow } from '@features/aria/utils/webInterviewMicPreInit';
import {
  getAudioCorrelationFields,
  getLastTtsCompletionCallbackMs,
  markLastAudioSessionEventType,
  writeAudioSessionLog,
} from '@utilities/sessionLogging/audioSessionLogEnvelope';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

export function logMicRecordingStartTelemetry(
  deps: HandleNativeOrWhisperMicPressDeps,
  tapIntentAtMs: number,
  intendedDelayMs: number,
): void {
  const {
    userId,
    recordingDelayMeasurementRef,
    lastHeadphoneProbeRef,
    lastAudioRouteFingerprintRef,
    currentInterviewMomentRef,
    currentScenarioRef,
    webSpeechShouldDeferToUserGesture,
    takeRecordingStartEventDataWithVadBypassRestart,
  } = deps;
  if (!userId) return;

  const r = getSessionLogRuntime();
  const corr = getAudioCorrelationFields();
  const probeSnapshot: HeadphoneProbeResult = lastHeadphoneProbeRef.current ?? {
    input: null,
    fingerprint: lastAudioRouteFingerprintRef.current,
    kind: getAudioRouteKind(),
    shouldShowHeadphonePrompt: false,
  };
  const btHint =
    probeSnapshot.input?.name && /bluetooth|airpod|wireless|buds/i.test(probeSnapshot.input.name)
      ? probeSnapshot.input.name.slice(0, 120)
      : null;
  const actualDelayMs = recordingDelayMsFromRef(recordingDelayMeasurementRef, tapIntentAtMs);

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
  const sampleReq = Platform.OS === 'web' ? 48000 : 44100;
  const sampleAct = Platform.OS === 'web' ? 48000 : 44100;
  markLastAudioSessionEventType('recording_quality_actual');
  writeAudioSessionLog({
    userId,
    attemptId: r.attemptId,
    eventType: 'recording_quality_actual',
    eventData: {
      sample_rate_requested: sampleReq,
      sample_rate_actual: sampleAct,
      bit_depth_actual: 16,
      channels_actual: 1,
      moment_number: currentInterviewMomentRef.current,
      sample_rate_below_requested: sampleAct < sampleReq,
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
  if (sinceTts != null && sinceTts > lateTh && !webSpeechShouldDeferToUserGesture()) {
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
