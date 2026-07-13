/** Accounts that use browser/default TTS (no ElevenLabs) and 2× playback for faster local testing. */
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

/** Set from interview screen when auth session email is known (drives TTS routing for the session). */
export function setInterviewTtsSessionEmail(email: string | null | undefined): void {
  const normalized = normalizeInterviewTtsAccountEmail(email);
  sessionEmail = normalized || null;
}

export function getInterviewTtsSessionEmail(): string | null {
  return sessionEmail;
}

export function shouldUseDefaultVoiceInsteadOfElevenLabs(): boolean {
  return isDefaultVoiceFastPlaybackAccountEmail(sessionEmail);
}
