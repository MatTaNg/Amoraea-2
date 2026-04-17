import { Platform } from 'react-native';
import { getLastAppliedAudioModeLabel } from '@features/aria/utils/audioModeHelpers';
import { getSessionLogRuntime } from './sessionLogContext';
import { getAudioCorrelationFields } from './audioSessionLogEnvelope';

export type AudioOutputRoute = 'speaker' | 'headphones' | 'bluetooth' | 'unknown';

/** Best-effort output route; JS cannot read iOS port reliably without native modules. */
function guessAudioOutputRoute(): AudioOutputRoute {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    const md = (navigator as unknown as { mediaDevices?: { selectAudioOutput?: unknown } }).mediaDevices;
    if (md && typeof md.selectAudioOutput === 'function') {
      /* future: user-selected sink */
    }
  }
  return 'unknown';
}

export type AudioSessionTelemetryPayload = {
  audio_output_route: AudioOutputRoute;
  audio_session_mode: string;
  recording_session_active: boolean;
  tts_playback_active_immediately_prior: boolean;
  volume_level: number | null;
} & Record<string, unknown>;

/** For `tts_playback_start` — recording_session_active means Whisper just ended before this TTS. */
export function gatherTtsPlaybackTelemetry(whisperJustEndedBeforePlayback: boolean): AudioSessionTelemetryPayload {
  const ctx = getSessionLogRuntime();
  return {
    audio_output_route: guessAudioOutputRoute(),
    audio_session_mode: getLastAppliedAudioModeLabel(),
    recording_session_active: whisperJustEndedBeforePlayback,
    tts_playback_active_immediately_prior: ctx.ttsPlaybackActive,
    volume_level: null,
    ...getAudioCorrelationFields(),
  };
}

/** For `recording_start` — recording_session_active reflects whether a session was still marked active (usually false). */
export function gatherRecordingStartTelemetry(): AudioSessionTelemetryPayload {
  const ctx = getSessionLogRuntime();
  return {
    audio_output_route: guessAudioOutputRoute(),
    audio_session_mode: getLastAppliedAudioModeLabel(),
    recording_session_active: ctx.recordingSessionActive,
    tts_playback_active_immediately_prior: ctx.ttsPlaybackActive,
    volume_level: null,
    ...getAudioCorrelationFields(),
  };
}
