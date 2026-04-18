/**
 * Web interview: prefetch ElevenLabs greeting MP3 during consent, play synchronously from Begin tap.
 */
import { Platform } from 'react-native';
import { fetchElevenLabsMpegArrayBuffer } from './elevenLabsTts';

export const WEB_INTERVIEW_OPENING_GREETING = "Hi, I'm Amoraea. What can I call you?";

let prefetchedObjectUrl: string | null = null;
let greetingAudioEl: HTMLAudioElement | null = null;

export function isWebInterviewGreetingPrefetchReady(): boolean {
  return Platform.OS === 'web' && prefetchedObjectUrl != null && greetingAudioEl != null;
}

export async function prefetchWebInterviewGreetingMp3(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (isWebInterviewGreetingPrefetchReady()) return true;
  const buf = await fetchElevenLabsMpegArrayBuffer(WEB_INTERVIEW_OPENING_GREETING, {
    allowBeforeWebUnlock: true,
  });
  if (!buf || buf.byteLength === 0) return false;
  prefetchedObjectUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
  const AudioCtor = (globalThis as unknown as { Audio?: new (src?: string) => HTMLAudioElement }).Audio;
  if (!AudioCtor) return false;
  const el = new AudioCtor(prefetchedObjectUrl);
  el.setAttribute('playsinline', '');
  if ('playsInline' in el) {
    (el as { playsInline: boolean }).playsInline = true;
  }
  el.preload = 'auto';
  greetingAudioEl = el;
  return true;
}

/** Synchronous `play()` — call only inside a user gesture, before any await. */
export function syncPlayPrefetchedWebInterviewGreeting(): boolean {
  if (!greetingAudioEl) return false;
  try {
    void greetingAudioEl.play();
    return true;
  } catch {
    return false;
  }
}

export function getPrefetchedGreetingHtmlAudioElement(): HTMLAudioElement | null {
  return greetingAudioEl;
}

export function releaseWebInterviewGreetingPrefetch(): void {
  try {
    greetingAudioEl?.pause();
  } catch {
    /* ignore */
  }
  greetingAudioEl = null;
  if (prefetchedObjectUrl) {
    try {
      URL.revokeObjectURL(prefetchedObjectUrl);
    } catch {
      /* ignore */
    }
  }
  prefetchedObjectUrl = null;
}
