import { Platform } from 'react-native';

/** Dev-bundle + localhost only: browser/default TTS (no ElevenLabs) and 2× playback for faster local testing. */
const DEFAULT_VOICE_FAST_PLAYBACK_EMAILS = new Set([
  'mattang5280@gmail.com',
  'ng5280@hotmail.com',
]);

let sessionEmail: string | null = null;

export function normalizeInterviewTtsAccountEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function isDefaultVoiceFastPlaybackAccountEmail(email: string | null | undefined): boolean {
  const normalized = normalizeInterviewTtsAccountEmail(email);
  return normalized.length > 0 && DEFAULT_VOICE_FAST_PLAYBACK_EMAILS.has(normalized);
}

/** True only for loopback web hosts used during local `expo start` / npm run web. */
export function isLocalWebDevHost(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

/** Set from interview screen when auth session email is known (drives TTS routing for the session). */
export function setInterviewTtsSessionEmail(email: string | null | undefined): void {
  const normalized = normalizeInterviewTtsAccountEmail(email);
  sessionEmail = normalized || null;
}

export function getInterviewTtsSessionEmail(): string | null {
  return sessionEmail;
}

/**
 * Dev-only fast path: skip ElevenLabs for listed accounts.
 * Never on production builds; never on non-localhost web (even if `__DEV__` is accidentally true).
 */
export function shouldUseDefaultVoiceInsteadOfElevenLabs(): boolean {
  if (!(typeof __DEV__ !== 'undefined' && __DEV__)) return false;
  if (Platform.OS === 'web' && !isLocalWebDevHost()) return false;
  return isDefaultVoiceFastPlaybackAccountEmail(sessionEmail);
}
