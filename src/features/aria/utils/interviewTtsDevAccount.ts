import { Platform } from 'react-native';

/**
 * Internal test accounts: device TTS (no ElevenLabs credits) and 2× speech rate on any platform/build.
 */
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

/** Skip ElevenLabs network TTS for configured internal test accounts (saves credits, uses expo-speech). */
export function shouldUseDefaultVoiceInsteadOfElevenLabs(): boolean {
  return isDefaultVoiceFastPlaybackAccountEmail(sessionEmail);
}
