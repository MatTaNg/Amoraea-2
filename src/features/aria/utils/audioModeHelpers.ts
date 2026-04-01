/**
 * Explicit audio session mode for iOS/Android so TTS plays through speaker
 * and recording uses the mic correctly. Call before every TTS and before/after recording.
 */
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

/** Call BEFORE every TTS playback so Amoraea speaks through the speaker at full volume. */
export async function setPlaybackMode(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: 1,
    interruptionModeAndroid: 1,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
  // Give iOS time to actually commit the route change before any playback starts
  if (Platform.OS === 'ios') {
    await new Promise(resolve => setTimeout(resolve, 80));
  }
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
  // Give iOS time to commit the audio session route change to the mic before recording starts
  if (Platform.OS === 'ios') {
    await new Promise(resolve => setTimeout(resolve, 150));
  }
}
