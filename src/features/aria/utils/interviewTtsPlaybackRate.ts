import { Platform } from 'react-native';

import { shouldUseDefaultVoiceInsteadOfElevenLabs } from './interviewTtsDevAccount';

const FAST_PLAYBACK_RATE = 2;

export function getLocalDevPlaybackRateMultiplier(): number {
  if (shouldUseDefaultVoiceInsteadOfElevenLabs()) return FAST_PLAYBACK_RATE;
  if (!(typeof __DEV__ !== 'undefined' && __DEV__)) return 1;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 1;
  const h = window.location.hostname.toLowerCase();
  const isLocal = h === 'localhost' || h === '127.0.0.1' || h === '::1';
  return isLocal ? FAST_PLAYBACK_RATE : 1;
}

export function getEffectivePlaybackRateMultiplier(explicit?: number): number {
  const base = explicit ?? getLocalDevPlaybackRateMultiplier();
  if (!Number.isFinite(base) || base <= 0) return 1;
  return Math.min(4, Math.max(0.5, base));
}
