import { Platform } from 'react-native';

import {
  getInterviewTtsSessionEmail,
  isDefaultVoiceFastPlaybackAccountEmail,
  isLocalWebDevHost,
} from './interviewTtsDevAccount';

const FAST_PLAYBACK_RATE = 2;
/** expo-speech rate for everyone else. `1.0` is normal; this is the warmer, slower interviewer pace. */
const NORMAL_DEVICE_SPEECH_RATE = 0.78;

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

/**
 * Device-speech rate. `1.0` is normal on expo-speech.
 * Configured accounts (including mattang5280@gmail.com) use 2, which is twice normal.
 */
export function getInterviewDeviceSpeechRate(): number {
  const multiplier = getLocalDevPlaybackRateMultiplier();
  if (multiplier <= 1) return NORMAL_DEVICE_SPEECH_RATE;
  return Math.min(2, multiplier);
}
