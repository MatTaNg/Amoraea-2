import { Platform } from 'react-native';

import {
  VAD_BYPASS_WHISPER_MIN_PEAK_ABOVE_AMBIENT_DB,
  VAD_GATE_BYPASS_REASON_NO_SAMPLE_EXCEEDED,
} from '@features/aria/onRecordingCompleteConstants';
import type { OnRecordingCompleteDeps, OnRecordingCompleteMeta, OnRecordingCompleteParams } from '@features/aria/onRecordingCompleteTypes';
import { looksLikeScenarioAContemptProbeQuestion } from '@features/aria/probeAndScoringUtils';
import { analyzeRecordingBuffer, type RecordingBufferAnalysis } from '@features/aria/utils/recordingBufferAnalysis';
import { getAudioSilenceDetectionThresholdMsForLogs } from '@features/aria/config/audioInterviewConfig';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import {
  markLastAudioSessionEventType,
  writeAudioSessionLog,
} from '@utilities/sessionLogging/audioSessionLogEnvelope';
import { remoteLog } from '@utilities/remoteLog';

export type RecordingCompleteBufferContext = {
  analysis: RecordingBufferAnalysis;
  webTiming: OnRecordingCompleteMeta['webRecordingTiming'];
  timeToFirstAudioMs: number | null;
  vadGateOpenedWallMs: number | null;
  vadGateDelayMs: number | null;
  timeSinceRecordingStartMs: number | null;
  vadGateBypassed: boolean;
  vadGateBypassReason: string | null;
  peakAboveAmbientDb: number | null;
  vadBypassSpeechLikelyByPeakVsAmbient: boolean;
  blockWhisperForVadBypassNoSpeech: boolean;
};

export async function computeRecordingCompleteBufferContext(
  deps: OnRecordingCompleteDeps,
  params: OnRecordingCompleteParams,
): Promise<RecordingCompleteBufferContext> {
  const { blob, meta } = params;
  const analysis = await analyzeRecordingBuffer(blob, meta?.peakMeteringDb ?? null);
  const webTiming = meta?.webRecordingTiming;
  const timeToFirstAudioMs =
    webTiming != null && analysis.firstSpeechOffsetMs != null && analysis.firstSpeechOffsetMs >= 0
      ? Math.round(
          analysis.firstSpeechOffsetMs + (webTiming.mediaRecorderStartAtMs - webTiming.tapIntentAtMs),
        )
      : null;
  const vadGateOpenedWallMs =
    webTiming?.mediaRecorderStartAtMs != null && analysis.firstSpeechOffsetMs != null
      ? webTiming.mediaRecorderStartAtMs + analysis.firstSpeechOffsetMs
      : null;
  const vadGateDelayMs =
    vadGateOpenedWallMs != null && webTiming?.recorderStartCalledMs != null
      ? Math.round(vadGateOpenedWallMs - webTiming.recorderStartCalledMs)
      : null;
  const timeSinceRecordingStartMs =
    webTiming?.recorderStartCalledMs != null && webTiming?.recorderStopCalledMs != null
      ? Math.round(webTiming.recorderStopCalledMs - webTiming.recorderStartCalledMs)
      : null;
  const vadGateBypassed =
    Platform.OS === 'web' &&
    analysis.has_non_zero_audio &&
    analysis.firstSpeechOffsetMs == null &&
    analysis.audio_duration_ms > 0;
  const vadGateBypassReason = vadGateBypassed ? VAD_GATE_BYPASS_REASON_NO_SAMPLE_EXCEEDED : null;
  const peakAboveAmbientDb =
    analysis.ambient_noise_floor_db != null &&
    Number.isFinite(analysis.ambient_noise_floor_db) &&
    Number.isFinite(analysis.peak_amplitude_db)
      ? analysis.peak_amplitude_db - analysis.ambient_noise_floor_db
      : null;
  const vadBypassSpeechLikelyByPeakVsAmbient =
    peakAboveAmbientDb != null && peakAboveAmbientDb >= VAD_BYPASS_WHISPER_MIN_PEAK_ABOVE_AMBIENT_DB;
  let blockWhisperForVadBypassNoSpeech =
    vadGateBypassReason === VAD_GATE_BYPASS_REASON_NO_SAMPLE_EXCEEDED &&
    !vadBypassSpeechLikelyByPeakVsAmbient;
  const contemptProbeAnswerVadGrace =
    looksLikeScenarioAContemptProbeQuestion(deps.lastQuestionTextRef.current ?? '') &&
    analysis.has_non_zero_audio &&
    analysis.buffer_size_bytes >= 32_000;
  if (contemptProbeAnswerVadGrace && blockWhisperForVadBypassNoSpeech) {
    blockWhisperForVadBypassNoSpeech = false;
    void remoteLog('[S1_CONTEMPT_PROBE] whisper_allowed_despite_vad_bypass', {
      buffer_size_bytes: analysis.buffer_size_bytes,
      peak_above_ambient_db: peakAboveAmbientDb,
    });
  }
  if (meta?.recordingCapped && deps.userId) {
    const r = getSessionLogRuntime();
    markLastAudioSessionEventType('recording_duration_cap_hit');
    writeAudioSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'recording_duration_cap_hit',
      eventData: {
        actual_duration_ms: analysis.audio_duration_ms,
        moment_number: deps.currentInterviewMomentRef.current,
        silence_detection_threshold_ms: getAudioSilenceDetectionThresholdMsForLogs(),
      },
      platform: r.platform,
    });
  }
  if (deps.userId) {
    const r = getSessionLogRuntime();
    markLastAudioSessionEventType('recording_buffer_content_check');
    writeAudioSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'recording_buffer_content_check',
      eventData: {
        audio_duration_ms: analysis.audio_duration_ms,
        buffer_size_bytes: analysis.buffer_size_bytes,
        has_non_zero_audio: analysis.has_non_zero_audio,
        peak_amplitude_db: analysis.peak_amplitude_db,
        time_to_first_audio_ms: timeToFirstAudioMs,
        recorder_start_called_ms: webTiming?.recorderStartCalledMs ?? null,
        first_chunk_received_ms: webTiming?.firstChunkReceivedMs ?? null,
        chunk_latency_ms: webTiming?.chunkLatencyMs ?? null,
        recorder_pre_initialized: webTiming?.recorderPreInitialized ?? null,
        pre_init_fallback_reason: webTiming?.preInitFallbackReason ?? null,
        stream_reactivated: webTiming?.streamReactivated ?? null,
        pre_init_triggered_during: webTiming?.preInitTriggeredDuring ?? null,
        vad_threshold_db: analysis.vad_threshold_db,
        ambient_noise_floor_db: analysis.ambient_noise_floor_db,
        vad_first_frame_accepted_db: analysis.vad_first_frame_accepted_db,
        ...(vadGateDelayMs != null ? { vad_gate_delay_ms: vadGateDelayMs } : {}),
        ...(timeSinceRecordingStartMs != null
          ? { time_since_recording_start_ms: timeSinceRecordingStartMs }
          : {}),
        ...(vadGateBypassed && vadGateBypassReason != null
          ? {
              vad_gate_bypassed: true,
              vad_gate_bypass_reason: vadGateBypassReason,
              ...(peakAboveAmbientDb != null
                ? { vad_peak_above_ambient_db: Math.round(peakAboveAmbientDb * 1000) / 1000 }
                : {}),
              ...(vadBypassSpeechLikelyByPeakVsAmbient
                ? { vad_bypass_whisper_allowed_peak_vs_ambient: true }
                : {}),
              ...(blockWhisperForVadBypassNoSpeech ? { whisper_submission_blocked_vad_bypass: true } : {}),
            }
          : {}),
        ...(vadGateOpenedWallMs != null ? { vad_gate_opened_ms: Math.round(vadGateOpenedWallMs) } : {}),
        moment_number: deps.currentInterviewMomentRef.current,
        scenario_number: deps.currentScenarioRef.current,
      },
      platform: r.platform,
    });
  }
  return {
    analysis,
    webTiming,
    timeToFirstAudioMs,
    vadGateOpenedWallMs,
    vadGateDelayMs,
    timeSinceRecordingStartMs,
    vadGateBypassed,
    vadGateBypassReason,
    peakAboveAmbientDb,
    vadBypassSpeechLikelyByPeakVsAmbient,
    blockWhisperForVadBypassNoSpeech,
  };
}
