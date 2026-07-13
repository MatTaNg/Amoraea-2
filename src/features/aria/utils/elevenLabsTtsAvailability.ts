import { Platform } from 'react-native';

import { computeElevenLabsEnabled, computeIosUseElevenLabsMp3Playback } from './elevenLabsEnvGating';
import { getTtsProxyUrl } from './elevenLabsTtsCredentials';
import { shouldUseDefaultVoiceInsteadOfElevenLabs } from './interviewTtsDevAccount';

/** True when ElevenLabs network TTS is allowed (production builds; not default __DEV__). */
export function isElevenLabsEnabledForEnvironment(): boolean {
  if (shouldUseDefaultVoiceInsteadOfElevenLabs()) return false;
  return computeElevenLabsEnabled({
    isDevBundle: typeof __DEV__ !== 'undefined' && __DEV__,
    env: {
      EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV:
        typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV : undefined,
      EXPO_PUBLIC_ELEVENLABS_TTS:
        typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_ELEVENLABS_TTS : undefined,
    },
    ttsProxyUrl: getTtsProxyUrl(),
  });
}

/** When false on iOS (default), use expo-speech so output stays on loudspeaker after recording. */
export function iosUseElevenLabsMp3Playback(): boolean {
  return computeIosUseElevenLabsMp3Playback({
    EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK:
      typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK : undefined,
  });
}

export function isElevenLabsMp3FetchAllowedOnPlatform(): boolean {
  return Platform.OS !== 'ios' || iosUseElevenLabsMp3Playback();
}
