import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';

import { webMicPreInitNeedsRefreshForNameEntry } from '@features/aria/utils/webInterviewMicPreInit';

export { webMicPreInitNeedsRefreshForNameEntry };

export async function raceTranscribeWithTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`${label}_timeout`)), ms);
  });
  try {
    return await Promise.race([p, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Returns mic permission state on web (Permissions API); 'unavailable' on native or unsupported. */
export async function checkMicPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unavailable'> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return 'unavailable';
  try {
    const perm = (navigator as { permissions?: { query: (p: { name: string }) => Promise<{ state: string }> } }).permissions;
    if (!perm) return 'unavailable';
    const result = await perm.query({ name: 'microphone' });
    const state = result.state as 'granted' | 'denied' | 'prompt';
    return state;
  } catch {
    return 'unavailable';
  }
}

export type RecordingDelayMeasurement = { modeCompleteAtMs: number; recordingInitializedAtMs: number };

export function recordingDelayMsFromRef(
  ref: MutableRefObject<RecordingDelayMeasurement | null>,
  tapIntentAtMs: number,
): number {
  const p = ref.current;
  if (p == null) return Date.now() - tapIntentAtMs;
  return p.recordingInitializedAtMs - tapIntentAtMs;
}
