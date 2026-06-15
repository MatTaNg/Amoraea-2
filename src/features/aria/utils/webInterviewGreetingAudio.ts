/**
 * Web interview: prefetch ElevenLabs greeting MP3 during consent, play synchronously from Begin tap.
 */
import { Platform } from 'react-native';
import {
  fetchElevenLabsMpegArrayBuffer,
  ensureWebHtmlAudioElementMaxVolume,
  ensureWebInterviewTtsOutputVolumePrimed,
  registerExtraWebInterviewPlaybackHooks,
} from './elevenLabsTts';

export const WEB_INTERVIEW_OPENING_GREETING = "Hi, I'm Amoraea. What can I call you?";

let prefetchedObjectUrl: string | null = null;
let greetingAudioEl: HTMLAudioElement | null = null;
/** True from sync `play()` until greeting `ended` — blocks route refresh / mic probe during audible intro. */
let greetingAudiblePlaybackActive = false;

export function isWebGreetingAudiblePlaybackActive(): boolean {
  return Platform.OS === 'web' && greetingAudiblePlaybackActive;
}

function clearGreetingAudiblePlaybackActive(): void {
  greetingAudiblePlaybackActive = false;
}

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
  ensureWebHtmlAudioElementMaxVolume(el);
  greetingAudioEl = el;
  await new Promise<void>((resolve) => {
    if (el.readyState >= 4) {
      resolve();
      return;
    }
    const done = () => {
      el.removeEventListener('canplaythrough', done);
      clearTimeout(tid);
      resolve();
    };
    el.addEventListener('canplaythrough', done, { once: true });
    const tid = setTimeout(done, 8000);
  });
  return true;
}

/** Synchronous `play()` — call only inside a user gesture, before any await. */
export function syncPlayPrefetchedWebInterviewGreeting(): boolean {
  if (!greetingAudioEl) return false;
  try {
    ensureWebInterviewTtsOutputVolumePrimed();
    ensureWebHtmlAudioElementMaxVolume(greetingAudioEl);
    greetingAudiblePlaybackActive = true;
    void greetingAudioEl.play();
    return true;
  } catch {
    clearGreetingAudiblePlaybackActive();
    return false;
  }
}

/** Wait for prefetched greeting already playing via {@link syncPlayPrefetchedWebInterviewGreeting}. */
export function waitForPrefetchedGreetingPlaybackEnd(el: HTMLAudioElement): Promise<void> {
  if (el.ended) {
    clearGreetingAudiblePlaybackActive();
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      clearGreetingAudiblePlaybackActive();
      resolve();
    };
    el.addEventListener('ended', done, { once: true });
    el.addEventListener(
      'error',
      () => {
        clearGreetingAudiblePlaybackActive();
        reject(new Error('greeting_audio_error'));
      },
      { once: true },
    );
  });
}

export function getPrefetchedGreetingHtmlAudioElement(): HTMLAudioElement | null {
  return greetingAudioEl;
}

/** Stop audible greeting without discarding the prefetched element (safe before a new sync play). */
export function stopWebInterviewGreetingPlaybackIfActive(): void {
  if (!greetingAudioEl) {
    clearGreetingAudiblePlaybackActive();
    return;
  }
  try {
    greetingAudioEl.pause();
    greetingAudioEl.currentTime = 0;
  } catch {
    /* ignore */
  }
  clearGreetingAudiblePlaybackActive();
}

export function releaseWebInterviewGreetingPrefetch(): void {
  stopWebInterviewGreetingPlaybackIfActive();
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

registerExtraWebInterviewPlaybackHooks({
  stop: stopWebInterviewGreetingPlaybackIfActive,
  isActive: isWebGreetingAudiblePlaybackActive,
});
