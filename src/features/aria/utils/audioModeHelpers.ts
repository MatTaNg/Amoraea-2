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
  if (Platform.OS === 'ios') {
    // Explicitly deactivate the current session first so AVAudioSession fully commits the route change.
    // Without this, the microphone may not activate and the recording captures silence.
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: 1,
      interruptionModeAndroid: 1,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: 1,
    interruptionModeAndroid: 1,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
  if (Platform.OS === 'ios') {
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
