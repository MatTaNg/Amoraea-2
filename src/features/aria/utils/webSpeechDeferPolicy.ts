/**
 * Pure policy for when mobile web should defer TTS to an explicit user gesture.
 * Used by {@link webSpeechShouldDeferToUserGesture}.
 */
import { Platform } from 'react-native';

export function getWebSpeechDeferFromNavigatorSnapshot(env: {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
}): boolean {
  const ua = env.userAgent || '';
  if (/iPhone|iPod/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;
  if (env.platform === 'MacIntel' && env.maxTouchPoints > 1) return true;
  if (/Android/i.test(ua)) return true;
  return false;
}

/**
 * Mobile browsers often block or silently drop async speechSynthesis / autoplay without a user gesture.
 * Defer to tap-to-speak (see AriaScreen + mic). Includes Android phones (e.g. Brave) — not only WebKit iOS.
 */
export function webSpeechShouldDeferToUserGesture(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return getWebSpeechDeferFromNavigatorSnapshot({
    userAgent: navigator.userAgent || '',
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}
