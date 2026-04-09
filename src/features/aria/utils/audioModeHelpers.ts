/**
 * Explicit audio session mode for iOS/Android so TTS plays through speaker
 * and recording uses the mic correctly. Call before every TTS and before/after recording.
 */
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

/** Call BEFORE every TTS playback so Amoraea speaks through the speaker at full volume. */
export async function setPlaybackMode(): Promise<void> {
  if (Platform.OS === 'web') return;
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
  if (Platform.OS === 'web') return;
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
