/**
 * TTS autoplay baseline telemetry (§2): Supabase `debug_logs` events for
 * measuring share of sessions where interviewer audio plays without an extra tap.
 * No PII: coarse browser family + mobile flag only (no full UA).
 */
import { Platform } from 'react-native';
import { remoteLog } from '@utilities/remoteLog';
import { setRecordingSessionActive } from '@utilities/sessionLogging/sessionLogContext';

export const TTS_AUTOPLAY_MESSAGE = '[TTS_AUTOPLAY]';
export const TTS_AUTOPLAY_MIC_STOP_MESSAGE = '[TTS_AUTOPLAY_MIC_STOP]';

export type TtsTelemetrySource = 'greeting' | 'turn' | 'replay' | 'other';

export type TtsAutoplayPipeline =
  | 'elevenlabs_web_html_audio'
  | 'elevenlabs_web_audio_context'
  | 'elevenlabs_web_pcm_stream'
  | 'web_speech_after_mp3_blocked'
  | 'elevenlabs_gesture_flush'
  | 'native_expo_av';

/** Coarse browser bucket for aggregates (Chrome / Safari / Firefox / Brave / Edge / other). */
export function getBrowserFamily(ua: string): string {
  if (/Firefox|FxiOS/i.test(ua)) return 'firefox';
  if (/Edg\//i.test(ua)) return 'edge';
  if (/Brave/i.test(ua)) return 'brave';
  if (/Chrome|CriOS|Chromium/i.test(ua)) return 'chrome';
  if (/Safari/i.test(ua) && !/Chrome|CriOS|Chromium/i.test(ua)) return 'safari';
  return 'other';
}

export function isMobileUserAgent(ua: string): boolean {
  return /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

export function getWebAutoplayContext(): {
  browserFamily: string;
  isMobileWeb: boolean;
  isSecureContext: boolean | null;
} {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    return { browserFamily: 'n/a', isMobileWeb: false, isSecureContext: null };
  }
  const ua = navigator.userAgent || '';
  return {
    browserFamily: getBrowserFamily(ua),
    isMobileWeb: isMobileUserAgent(ua),
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : null,
  };
}

/** Fire-and-forget: TTS play attempt outcome (web + native where applicable). */
export function logTtsAutoplayPlayOutcome(payload: {
  pipeline: TtsAutoplayPipeline;
  outcome:
    | 'play_ok'
    | 'play_blocked_autoplay'
    | 'play_error'
    | 'playback_timeout'
    | 'gesture_flush_ok'
    | 'gesture_flush_rejected';
  telemetrySource?: TtsTelemetrySource;
  errorName?: string;
  errorMessagePreview?: string;
}): void {
  const ctx = getWebAutoplayContext();
  void remoteLog(TTS_AUTOPLAY_MESSAGE, {
    ...payload,
    platform: Platform.OS,
    ...ctx,
  });
}

/** Web: MediaRecorder finished after user tapped stop (correlate with following TTS events by time). */
export function logWebMicRecordingStopped(payload: {
  blobBytes: number;
  mime: string;
  elapsedMs?: number;
}): void {
  if (Platform.OS !== 'web') return;
  const ctx = getWebAutoplayContext();
  void remoteLog(TTS_AUTOPLAY_MIC_STOP_MESSAGE, {
    ...payload,
    ...ctx,
    ts: Date.now(),
  });
  /** Recording session ends when the mic stops and the blob is finalized — before transcription / TTS. */
  setRecordingSessionActive(false);
}

/** Native: recording stopped and blob ready (parity for non-web sessions). */
export function logNativeMicRecordingStopped(payload: { blobBytes: number; platformOs: string }): void {
  void remoteLog(TTS_AUTOPLAY_MIC_STOP_MESSAGE, {
    ...payload,
    ts: Date.now(),
  });
  setRecordingSessionActive(false);
}
