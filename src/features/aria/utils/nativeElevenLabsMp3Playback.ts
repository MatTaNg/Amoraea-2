import * as FileSystem from 'expo-file-system';

import { logTtsAutoplayPlayOutcome, type TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { logAndApplyPlaybackModeForTts } from './audioModeHelpers';

/** Avoid top-level `expo-av` import — it breaks web lazy-load of the interview chunk (SDK 53+). */
function getExpoAvAudio(): typeof import('expo-av').Audio {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-av').Audio;
}

/** Native ElevenLabs MP3 playback; must be stopped/unloaded before starting another clip. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- expo-av Sound instance
let activeNativeTtsSound: any = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  if (typeof globalThis !== 'undefined' && typeof (globalThis as unknown as { btoa?: (s: string) => string }).btoa === 'function') {
    return (globalThis as unknown as { btoa: (s: string) => string }).btoa(binary);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  throw new Error('No base64 encoder available');
}

export async function stopNativeElevenLabsMp3Playback(): Promise<void> {
  const s = activeNativeTtsSound;
  activeNativeTtsSound = null;
  if (!s) return;
  try {
    await s.stopAsync();
  } catch {
    /* ignore */
  }
  try {
    await s.unloadAsync();
  } catch {
    /* ignore */
  }
}

export function resetNativeElevenLabsMp3PlaybackState(): void {
  activeNativeTtsSound = null;
}

export async function playNativeElevenLabsMpegArrayBuffer(
  arrayBuffer: ArrayBuffer,
  onPlaybackStarted: (() => void) | undefined,
  telemetrySource: TtsTelemetrySource
): Promise<void> {
  const base64 = arrayBufferToBase64(arrayBuffer);
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) {
    throw new Error('native_tts_no_cache_dir');
  }
  const fileUri = `${dir}tts_${Date.now()}.mp3`;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await logAndApplyPlaybackModeForTts('speakWithElevenLabs:nativeBeforeSoundCreate');
  const Audio = getExpoAvAudio();
  const { sound } = await Audio.Sound.createAsync(
    { uri: fileUri },
    { shouldPlay: false, volume: 1.0, isMuted: false }
  );
  activeNativeTtsSound = sound;

  try {
    await new Promise<void>((resolve, reject) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          resolve();
        }
      });
      sound
        .playAsync()
        .then((st) => {
          if (st.isLoaded) {
            onPlaybackStarted?.();
            logTtsAutoplayPlayOutcome({
              pipeline: 'native_expo_av',
              outcome: 'play_ok',
              telemetrySource,
            });
          }
        })
        .catch((e: unknown) => {
          const err = e instanceof Error ? e : new Error(String(e));
          logTtsAutoplayPlayOutcome({
            pipeline: 'native_expo_av',
            outcome: 'play_error',
            telemetrySource,
            errorName: err.name,
            errorMessagePreview: err.message?.slice(0, 120),
          });
          reject(err);
        });
    });
  } finally {
    if (activeNativeTtsSound === sound) {
      activeNativeTtsSound = null;
    }
    try {
      await sound.unloadAsync();
    } catch {
      /* ignore */
    }
  }
  try {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  } catch {
    /* ignore cleanup errors */
  }
}
