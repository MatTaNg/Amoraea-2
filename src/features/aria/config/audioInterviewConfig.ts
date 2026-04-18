/**
 * Interview audio / VAD-adjacent tuning — override via EXPO_PUBLIC_* env (app.config / EAS).
 * Logged once in dev on first read so QA can see effective values without rebuilding native code for every tweak.
 *
 * Native: expo-av `isMeteringEnabled` + peak dB (`RecordingStatus.metering`) vs these thresholds.
 * Web (MediaRecorder): min record duration before stop; live level uses Web Audio analyser on the mic stream.
 * Web (SpeechRecognition fallback): browser controls endpointing — no sensitivity knob; use Chrome flags or prefer MediaRecorder+Whisper.
 *
 * Full overlapping chunk streaming to Whisper (200 ms overlap) is not wired yet; Whisper calls use a timeout + retry instead.
 */

function envNum(key: string, fallback: number): number {
  const raw =
    (typeof process !== 'undefined' && process.env?.[`EXPO_PUBLIC_${key}`]) || '';
  const n = Number.parseFloat(String(raw).trim());
  return Number.isFinite(n) ? n : fallback;
}

function envInt(key: string, fallback: number): number {
  const raw =
    (typeof process !== 'undefined' && process.env?.[`EXPO_PUBLIC_${key}`]) || '';
  const n = Number.parseInt(String(raw).trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

import {
  getRouteAmbientCeilingDbOffset,
  getRouteSpeechMeteringDbOffset,
} from '@features/aria/config/audioRouteRuntime';

let logged = false;

/** Peak metering (dBFS, roughly -160…0 from expo-av). Louder = closer to 0. */
export function getAudioVadSpeechMeteringMinDb(): number {
  /** 6 dB more permissive for quiet microphones vs prior -52 default. */
  return envNum('AUDIO_VAD_SPEECH_METERING_MIN_DB', -58);
}

/** Base + runtime route offset (e.g. built-in mic vs headset). */
export function getEffectiveVadSpeechMeteringMinDb(): number {
  return getAudioVadSpeechMeteringMinDb() + getRouteSpeechMeteringDbOffset();
}

/**
 * Below this peak, treat as silence / noise-only for "retry" gating (more negative = stricter).
 * Typical quiet room noise: -60…-45; softer voices may peak around -50…-40.
 */
export function getAudioAmbientNoiseCeilingDb(): number {
  /** 6 dB more permissive — was -58. */
  return envNum('AUDIO_AMBIENT_NOISE_CEILING_DB', -64);
}

export function getEffectiveAmbientNoiseCeilingDb(): number {
  return getAudioAmbientNoiseCeilingDb() + getRouteAmbientCeilingDbOffset();
}

/** Minimum recording length (web tap-to-stop) before stop is applied — reduces premature cut-off. */
export function getAudioMinRecordingDurationMs(): number {
  const v = envInt('AUDIO_MIN_RECORDING_MS', 1500);
  return Math.max(800, v);
}

/** Metering poll interval for native recording status updates (UI + peak tracking). */
export function getAudioMeteringPollIntervalMs(): number {
  const v = envInt('AUDIO_METERING_POLL_INTERVAL_MS', 250);
  return Math.max(50, Math.min(1000, v));
}

/** Whisper HTTP/upload overall timeout before retry (per request). */
export function getAudioWhisperTimeoutMs(): number {
  const v = envInt('AUDIO_WHISPER_TIMEOUT_MS', 8000);
  return Math.max(3000, Math.min(120_000, v));
}

/** Hard cap: auto-stop recording and send buffer to Whisper (no user message). */
export function getAudioMaxRecordingDurationMs(): number {
  return 120_000;
}

/** Logged with `recording_duration_cap_hit` when only timer cap applies (no separate silence endpoint). */
export function getAudioSilenceDetectionThresholdMsForLogs(): number | null {
  return null;
}

/** After TTS, if the user starts recording later than this, `late_start` / `late_start_extended` apply (ms). */
export function getLateStartThresholdMs(): number {
  return envInt('LATE_START_THRESHOLD_MS', 10_000);
}

/** RMS floor (0–1) for web AudioContext energy probe — below this, likely silent. */
export function getAudioWebRmsEnergyFloor(): number {
  /** ~6 dB lower linear floor than 0.012 for quiet capture paths. */
  return envNum('AUDIO_WEB_RMS_ENERGY_FLOOR', 0.006);
}

export function logAudioInterviewConfigOnce(): void {
  if (logged || !__DEV__) return;
  logged = true;
  console.log('[Audio/config] interview audio', {
    AUDIO_VAD_SPEECH_METERING_MIN_DB: getAudioVadSpeechMeteringMinDb(),
    effective_VAD_MIN_DB: getEffectiveVadSpeechMeteringMinDb(),
    AUDIO_AMBIENT_NOISE_CEILING_DB: getAudioAmbientNoiseCeilingDb(),
    effective_AMBIENT_CEILING_DB: getEffectiveAmbientNoiseCeilingDb(),
    AUDIO_MIN_RECORDING_MS: getAudioMinRecordingDurationMs(),
    AUDIO_METERING_POLL_INTERVAL_MS: getAudioMeteringPollIntervalMs(),
    AUDIO_WHISPER_TIMEOUT_MS: getAudioWhisperTimeoutMs(),
    AUDIO_WEB_RMS_ENERGY_FLOOR: getAudioWebRmsEnergyFloor(),
  });
}
