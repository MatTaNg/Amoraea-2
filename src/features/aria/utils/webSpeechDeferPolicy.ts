/**
 * Pure policy for when mobile web should defer TTS to an explicit user gesture.
 * Used by {@link webSpeechShouldDeferToUserGesture} in `elevenLabsTts.ts`.
 */
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
