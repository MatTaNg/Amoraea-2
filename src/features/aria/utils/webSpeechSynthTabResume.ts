import { Platform } from 'react-native';

const WEB_SPEECH_SYNTH_EST_CHARS_PER_SEC = 14;

let webSpeechSynthTabResumeState: { fullText: string; startedAtMs: number } | null = null;

export function markWebSpeechSynthTabResumeStarted(fullText: string): void {
  webSpeechSynthTabResumeState = { fullText, startedAtMs: Date.now() };
}

export function clearWebSpeechSynthTabResumeState(): void {
  webSpeechSynthTabResumeState = null;
}

/** Call before tab-hide cancels speechSynthesis — returns remaining text estimate, or null. */
export function captureWebSpeechSynthTabRestoreText(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const snap = webSpeechSynthTabResumeState;
  if (!snap?.fullText.trim()) return null;
  const speaking = window.speechSynthesis?.speaking === true;
  const elapsedMs = Date.now() - snap.startedAtMs;
  if (!speaking && elapsedMs > 4000) return null;
  const spokenChars = Math.floor((elapsedMs / 1000) * WEB_SPEECH_SYNTH_EST_CHARS_PER_SEC);
  const remaining = snap.fullText.slice(Math.min(spokenChars, snap.fullText.length)).trim();
  if (remaining.length < 12) return null;
  return remaining;
}
