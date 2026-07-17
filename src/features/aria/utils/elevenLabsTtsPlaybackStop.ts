import * as Speech from 'expo-speech';

import { stopNativeElevenLabsMp3Playback } from './nativeElevenLabsMp3Playback';

/** Stop expo-speech and any in-progress native ElevenLabs MP3. */
export async function stopElevenLabsPlayback(): Promise<void> {
  Speech.stop();
  await stopNativeElevenLabsMp3Playback();
}

/** Stop any current TTS. Safe to fire-and-forget from UI handlers. */
export function stopElevenLabsSpeech(): void {
  void stopElevenLabsPlayback();
}
