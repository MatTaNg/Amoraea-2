import { looksLikeInterviewClosingAssistantMessage } from './elongatingProbe';

/** Survives AriaScreen remounts — prevents duplicate closing TTS from parallel stream + replay paths. */
let lastClosingSessionKey: string | null = null;
let lastClosingTextNorm: string | null = null;
/** Set while closing TTS is in-flight for an attempt (survives remount). */
let closingSpeakInFlightSessionKey: string | null = null;

function normalizeClosingTtsKey(text: string): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!flat) return '';
  return flat.replace(/[^\p{L}\p{N}]/gu, '');
}

export function hasInterviewClosingSpeakInFlightForSession(
  sessionKey: string | null | undefined,
): boolean {
  if (!sessionKey?.trim()) return false;
  return closingSpeakInFlightSessionKey === sessionKey.trim();
}

/** Reserve closing speak for this attempt; false if already delivered or in-flight. */
export function tryAcquireInterviewClosingSpeak(
  sessionKey: string | null | undefined,
): boolean {
  if (!sessionKey?.trim()) return true;
  const key = sessionKey.trim();
  if (hasInterviewClosingTtsDeliveredForSession(key)) return false;
  if (closingSpeakInFlightSessionKey === key) return false;
  closingSpeakInFlightSessionKey = key;
  return true;
}

export function releaseInterviewClosingSpeak(sessionKey: string | null | undefined): void {
  if (!sessionKey?.trim()) return;
  if (closingSpeakInFlightSessionKey === sessionKey.trim()) {
    closingSpeakInFlightSessionKey = null;
  }
}

export function shouldSuppressDuplicateInterviewClosingTts(
  sessionKey: string | null | undefined,
  text: string,
): boolean {
  if (!sessionKey?.trim()) return false;
  const key = sessionKey.trim();
  if (!looksLikeInterviewClosingAssistantMessage(text)) return false;
  // tryAcquireInterviewClosingSpeak gates concurrent enqueue; do not treat in-flight alone as delivered.
  if (hasInterviewClosingTtsDeliveredForSession(key)) return true;
  const norm = normalizeClosingTtsKey(text);
  if (!norm) return false;
  return lastClosingSessionKey === key && lastClosingTextNorm === norm;
}

export function markInterviewClosingTtsDelivered(
  sessionKey: string | null | undefined,
  text: string,
): void {
  if (!sessionKey?.trim()) return;
  if (!looksLikeInterviewClosingAssistantMessage(text)) return;
  const norm = normalizeClosingTtsKey(text);
  if (!norm) return;
  lastClosingSessionKey = sessionKey.trim();
  lastClosingTextNorm = norm;
  if (closingSpeakInFlightSessionKey === sessionKey.trim()) {
    closingSpeakInFlightSessionKey = null;
  }
}

export function hasInterviewClosingTtsDeliveredForSession(
  sessionKey: string | null | undefined,
): boolean {
  if (!sessionKey?.trim()) return false;
  return lastClosingSessionKey === sessionKey.trim() && !!lastClosingTextNorm;
}

export function resetInterviewClosingTtsSession(): void {
  lastClosingSessionKey = null;
  lastClosingTextNorm = null;
  closingSpeakInFlightSessionKey = null;
}
