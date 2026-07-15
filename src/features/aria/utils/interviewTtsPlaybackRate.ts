import { Platform } from 'react-native';

import { isLocalWebDevHost, shouldUseDefaultVoiceInsteadOfElevenLabs } from './interviewTtsDevAccount';

const FAST_PLAYBACK_RATE = 2;

/**
 * 2× only for local development. Production builds and non-localhost web hosts always return 1.
 */
export function getLocalDevPlaybackRateMultiplier(): number {
  if (!(typeof __DEV__ !== 'undefined' && __DEV__)) return 1;
  if (Platform.OS === 'web') {
    return isLocalWebDevHost() ? FAST_PLAYBACK_RATE : 1;
  }
  return shouldUseDefaultVoiceInsteadOfElevenLabs() ? FAST_PLAYBACK_RATE : 1;
}

export function getEffectivePlaybackRateMultiplier(explicit?: number): number {
  const base = explicit ?? getLocalDevPlaybackRateMultiplier();
  if (!Number.isFinite(base) || base <= 0) return 1;
  return Math.min(4, Math.max(0.5, base));
}
