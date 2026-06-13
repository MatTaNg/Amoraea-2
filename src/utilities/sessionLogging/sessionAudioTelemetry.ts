import { getLastAppliedAudioModeLabel } from '@features/aria/utils/audioModeHelpers';
import {
  getInterviewSessionAmbientNoiseFloorDb,
  getInterviewSessionAmbientNoiseFallback,
  getInterviewSessionVadFirstSpeechThresholdDb,
  getInterviewSessionVadThresholdFloored,
  getInterviewSessionVadThresholdUnusuallyHigh,
} from '@features/aria/utils/interviewVadSession';
import {
  getLastPreInitTriggerDuring,
  takeRecorderRefreshedOnLateStartForTelemetry,
} from '@features/aria/utils/webInterviewMicPreInit';
import { takeRecordingStartPreauthorizedFlag } from '@features/aria/utils/webPreAuthorizedTtsAudio';
import { takeSessionResumedForFirstRecordingStart } from '@utilities/sessionLogging/sessionResumeRecordingTelemetry';
import { getSessionLogRuntime } from './sessionLogContext';
import { getAudioCorrelationFields, type SessionOutputRouteLabel } from './audioSessionLogEnvelope';

export type AudioOutputRoute = SessionOutputRouteLabel;

export type AudioSessionTelemetryPayload = {
  audio_output_route: AudioOutputRoute;
  audio_session_mode: string;
  recording_session_active: boolean;
  tts_playback_active_immediately_prior: boolean;
  volume_level: number | null;
} & Record<string, unknown>;

/** For `tts_playback_start` — `tts_playback_active_immediately_prior` is captured before this turn sets TTS active. */
export function gatherTtsPlaybackTelemetry(args: {
  ttsPlaybackActiveImmediatelyPrior: boolean;
}): AudioSessionTelemetryPayload {
  const ctx = getSessionLogRuntime();
  const corr = getAudioCorrelationFields();
  const out = (corr.output_route as AudioOutputRoute) ?? 'unknown';
  return {
    ...corr,
    audio_output_route: out,
    audio_session_mode: getLastAppliedAudioModeLabel(),
    recording_session_active: ctx.recordingSessionActive,
    tts_playback_active_immediately_prior: args.ttsPlaybackActiveImmediatelyPrior,
    volume_level: null,
  };
}

/** Parallel streaming TTS — always buffered MP3 chunks (prefetch or inline fetch). */
export function gatherParallelStreamingTtsPlaybackTelemetry(args: {
  ttsPlaybackActiveImmediatelyPrior: boolean;
  afterRecording: boolean;
  charCount: number;
  momentNumber: number;
  scenarioNumber: number;
  prefetchedMpeg: boolean;
  htmlAudioVolume: number | null;
}): AudioSessionTelemetryPayload & {
  telemetry_source: 'turn';
  tts_pipeline: 'parallel_streaming';
  playback_strategy: 'buffered_complete';
  tts_buffer_complete_before_playback: true;
  after_recording: boolean;
  char_count: number;
  moment_number: number;
  scenario_number: number;
  prefetched_mpeg: boolean;
  html_audio_volume: number | null;
  tts_trigger_source: 'callback';
} {
  return {
    ...gatherTtsPlaybackTelemetry({
      ttsPlaybackActiveImmediatelyPrior: args.ttsPlaybackActiveImmediatelyPrior,
    }),
    telemetry_source: 'turn',
    tts_pipeline: 'parallel_streaming',
    playback_strategy: 'buffered_complete',
    tts_buffer_complete_before_playback: true,
    after_recording: args.afterRecording,
    char_count: args.charCount,
    moment_number: args.momentNumber,
    scenario_number: args.scenarioNumber,
    prefetched_mpeg: args.prefetchedMpeg,
    html_audio_volume: args.htmlAudioVolume,
    tts_trigger_source: 'callback',
  };
}

/** For `recording_start` — recording_session_active reflects whether a session was still marked active (usually false). */
export function gatherRecordingStartTelemetry(): AudioSessionTelemetryPayload {
  const ctx = getSessionLogRuntime();
  const corr = getAudioCorrelationFields();
  const out = (corr.output_route as AudioOutputRoute) ?? 'unknown';
  return {
    ...corr,
    audio_output_route: out,
    audio_session_mode: getLastAppliedAudioModeLabel(),
    recording_session_active: ctx.recordingSessionActive,
    tts_playback_active_immediately_prior: ctx.ttsPlaybackActive,
    volume_level: null,
    vad_threshold_db: getInterviewSessionVadFirstSpeechThresholdDb(),
    ambient_noise_floor_db: getInterviewSessionAmbientNoiseFloorDb(),
    ambient_noise_fallback: getInterviewSessionAmbientNoiseFallback(),
    vad_threshold_floored: getInterviewSessionVadThresholdFloored(),
    vad_threshold_unusually_high: getInterviewSessionVadThresholdUnusuallyHigh(),
    pre_init_triggered_during: getLastPreInitTriggerDuring(),
    audio_element_preauthorized: takeRecordingStartPreauthorizedFlag(),
    recorder_refreshed_on_late_start: takeRecorderRefreshedOnLateStartForTelemetry(),
    session_resumed: takeSessionResumedForFirstRecordingStart(),
  };
}
