import { Platform } from 'react-native';

import {
  getInterviewTtsSessionEmail,
  isDefaultVoiceFastPlaybackAccountEmail,
  isLocalWebDevHost,
} from './interviewTtsDevAccount';

const FAST_PLAYBACK_RATE = 2;

/**
 * 2× for configured internal test accounts; otherwise localhost web dev only.
 */
export function getLocalDevPlaybackRateMultiplier(): number {
  if (isDefaultVoiceFastPlaybackAccountEmail(getInterviewTtsSessionEmail())) {
    return FAST_PLAYBACK_RATE;
  }
  if (!(typeof __DEV__ !== 'undefined' && __DEV__)) return 1;
  if (Platform.OS === 'web') {
    return isLocalWebDevHost() ? FAST_PLAYBACK_RATE : 1;
  }
  return 1;
}

export function getEffectivePlaybackRateMultiplier(explicit?: number): number {
  const base = explicit ?? getLocalDevPlaybackRateMultiplier();
  if (!Number.isFinite(base) || base <= 0) return 1;
  return Math.min(4, Math.max(0.5, base));
}
