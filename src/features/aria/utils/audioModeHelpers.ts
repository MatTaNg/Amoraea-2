/**
 * Explicit audio session mode for iOS/Android so TTS plays through speaker
 * and recording uses the mic correctly. Call before every TTS and before/after recording.
 */
import { Platform } from 'react-native';

/** Avoid top-level `import 'expo-av'` — it breaks web lazy-loading of interview (SDK 53+ deprecation / init). */
function getExpoAvAudio(): typeof import('expo-av').Audio {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-av').Audio;
}

/** Last mode applied via `setPlaybackMode` / `setRecordingMode` — for session_logs telemetry only. */
let lastAppliedAudioModeLabel: 'playback' | 'recording' | 'web' = 'web';

export function getLastAppliedAudioModeLabel(): typeof lastAppliedAudioModeLabel {
  return lastAppliedAudioModeLabel;
}

/** Call BEFORE every TTS playback so Amoraea speaks through the speaker at full volume. */
export async function setPlaybackMode(): Promise<void> {
  if (Platform.OS === 'web') {
    lastAppliedAudioModeLabel = 'web';
    return;
  }
  lastAppliedAudioModeLabel = 'playback';
  const Audio = getExpoAvAudio();
  const playbackMode = {
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: 1,
    interruptionModeAndroid: 1,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  } as const;
  await Audio.setAudioModeAsync({ ...playbackMode });
}

/**
 * Log intended expo-av playback mode right before TTS (iOS session is not readable via JS).
 * Call after stopping any prior playback/recording.
 */
export async function logAndApplyPlaybackModeForTts(context: string): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[Audio/TTS] pre-playback', { context, platform: 'web' });
    return;
  }
  console.log('[Audio/TTS] pre-playback', { context, platform: Platform.OS, phase: 'before_setPlaybackMode' });
  await setPlaybackMode();
  const snapshot = {
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    playThroughEarpieceAndroid: false,
    shouldDuckAndroid: true,
  };
  console.log('[Audio/TTS] pre-playback', { context, platform: Platform.OS, phase: 'after_setPlaybackMode', audioMode: snapshot });
}

/** Call BEFORE every mic recording so input is captured correctly. */
export async function setRecordingMode(): Promise<void> {
  if (Platform.OS === 'web') {
    lastAppliedAudioModeLabel = 'web';
    return;
  }
  lastAppliedAudioModeLabel = 'recording';
  const Audio = getExpoAvAudio();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: 1,
    interruptionModeAndroid: 1,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}
