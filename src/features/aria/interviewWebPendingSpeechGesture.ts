import type { MutableRefObject } from 'react';

/** Mirrors `pendingWebSpeechForGestureRef` so React Strict Mode remount does not drop queued text. */
let pendingWebSpeechForGestureModule: string | null = null;

const WEB_GESTURE_TTS_STORAGE_KEY = 'aria_v1_pending_gesture_tts';

export function readStoredPendingGestureTts(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    return sessionStorage.getItem(WEB_GESTURE_TTS_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setPendingWebSpeechGesturePair(ref: MutableRefObject<string | null>, text: string): void {
  ref.current = text;
  pendingWebSpeechForGestureModule = text;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(WEB_GESTURE_TTS_STORAGE_KEY, text);
    }
  } catch {
    /* private mode / quota */
  }
}

export function clearPendingWebSpeechGesturePair(ref: MutableRefObject<string | null>): void {
  ref.current = null;
  pendingWebSpeechForGestureModule = null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(WEB_GESTURE_TTS_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function peekPendingWebSpeechGesture(ref: MutableRefObject<string | null>): string | null {
  return ref.current ?? pendingWebSpeechForGestureModule ?? readStoredPendingGestureTts();
}
