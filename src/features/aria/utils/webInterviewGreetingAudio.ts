/**
 * Web interview: prefetch ElevenLabs greeting MP3 during consent, play synchronously from Begin tap.
 */
import { Platform } from 'react-native';
import { fetchElevenLabsMpegArrayBuffer } from './elevenLabsTtsFetch';
import { isElevenLabsEnabledForEnvironment } from './elevenLabsTtsAvailability';
import { getLocalDevPlaybackRateMultiplier } from './interviewTtsPlaybackRate';
import { ensureWebHtmlAudioElementMaxVolume } from './webInterviewHtmlAudioVolume';
import { ensureWebInterviewTtsOutputVolumePrimed } from './webInterviewTtsOutputVolume';
import { registerExtraWebInterviewPlaybackHooks } from './webInterviewWebAudioPlaybackSurface';

export const WEB_INTERVIEW_OPENING_GREETING = "Hi, I'm Amoraea. What can I call you?";

export type WebInterviewOpeningGreetingSyncMode = 'prefetch' | 'web_speech';

let prefetchedObjectUrl: string | null = null;
let greetingAudioEl: HTMLAudioElement | null = null;
/** True from sync `play()` until greeting `ended` — blocks route refresh / mic probe during audible intro. */
let greetingAudiblePlaybackActive = false;
let openingGreetingSyncMode: WebInterviewOpeningGreetingSyncMode | null = null;
let webSpeechOpeningGreetingEndPromise: Promise<void> | null = null;

export function getWebInterviewOpeningGreetingSyncMode(): WebInterviewOpeningGreetingSyncMode | null {
  return openingGreetingSyncMode;
}

export function isWebInterviewOpeningGreetingSyncAudible(): boolean {
  if (Platform.OS !== 'web') return false;
  if (openingGreetingSyncMode === 'prefetch') {
    if (!greetingAudiblePlaybackActive || !greetingAudioEl) return false;
    const el = greetingAudioEl;
    if (el.ended) return false;
    if (!el.paused && el.currentTime > 0) return true;
    if (!el.paused && el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return true;
    return false;
  }
  if (openingGreetingSyncMode === 'web_speech') {
    return typeof window !== 'undefined' && window.speechSynthesis?.speaking === true;
  }
  return false;
}

/**
 * Mic permission UI often interrupts sync greeting started on the Begin tap.
 * Reset stale sync flags so the deliver path replays instead of waiting forever.
 */
export function resetWebInterviewOpeningGreetingSyncIfInterrupted(): boolean {
  if (Platform.OS !== 'web') return false;
  if (!greetingAudiblePlaybackActive && openingGreetingSyncMode == null) return false;
  if (isWebInterviewOpeningGreetingSyncAudible()) return false;
  if (openingGreetingSyncMode === 'web_speech' && typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
  if (openingGreetingSyncMode === 'prefetch' && greetingAudioEl) {
    try {
      greetingAudioEl.pause();
      greetingAudioEl.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
  clearGreetingAudiblePlaybackActive();
  clearOpeningGreetingSyncState();
  return true;
}

function clearOpeningGreetingSyncState(): void {
  openingGreetingSyncMode = null;
  webSpeechOpeningGreetingEndPromise = null;
}

function pickStableWebSpeechVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const list = window.speechSynthesis.getVoices();
  return (
    list.find((v) => /samantha|google us english|zira|karen|victoria/i.test(v.name) && /^en/i.test(v.lang)) ??
    list.find((v) => (v as SpeechSynthesisVoice & { localService?: boolean }).localService === true && /^en/i.test(v.lang)) ??
    list.find((v) => /^en(-|$)/i.test(v.lang)) ??
    null
  );
}

/** Browser Speech API fallback — must run synchronously inside the Begin tap (before any await). */
function syncSpeakWebInterviewOpeningGreetingWithWebSpeech(): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(WEB_INTERVIEW_OPENING_GREETING);
    utter.lang = 'en-US';
    utter.rate = Math.min(4, Math.max(0.5, 0.92 * getLocalDevPlaybackRateMultiplier()));
    utter.pitch = 0.95;
    const voice = pickStableWebSpeechVoice();
    if (voice) utter.voice = voice;
    greetingAudiblePlaybackActive = true;
    openingGreetingSyncMode = 'web_speech';
    webSpeechOpeningGreetingEndPromise = new Promise<void>((resolve) => {
      const finish = () => {
        clearGreetingAudiblePlaybackActive();
        clearOpeningGreetingSyncState();
        resolve();
      };
      utter.onend = finish;
      utter.onerror = finish;
    });
    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    clearGreetingAudiblePlaybackActive();
    clearOpeningGreetingSyncState();
    return false;
  }
}

/**
 * Start the opening greeting inside a user gesture — prefetched MP3 when ready, else Web Speech.
 * Must run before any await in the Begin interview handler.
 */
export function trySyncStartWebInterviewOpeningGreetingFromUserGesture(): boolean {
  if (Platform.OS !== 'web') return false;
  clearOpeningGreetingSyncState();
  if (isWebInterviewGreetingPrefetchReady() && syncPlayPrefetchedWebInterviewGreeting()) {
    openingGreetingSyncMode = 'prefetch';
    return true;
  }
  return syncSpeakWebInterviewOpeningGreetingWithWebSpeech();
}

export function waitForWebInterviewOpeningGreetingSyncEnd(): Promise<void> {
  if (openingGreetingSyncMode === 'prefetch' && greetingAudioEl) {
    return waitForPrefetchedGreetingPlaybackEnd(greetingAudioEl).finally(() => {
      clearOpeningGreetingSyncState();
    });
  }
  if (openingGreetingSyncMode === 'web_speech' && webSpeechOpeningGreetingEndPromise) {
    return webSpeechOpeningGreetingEndPromise;
  }
  return Promise.resolve();
}

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
  if (!isElevenLabsEnabledForEnvironment()) return false;
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
  if (greetingAudioEl.readyState < 2) return false;
  try {
    ensureWebInterviewTtsOutputVolumePrimed();
    ensureWebHtmlAudioElementMaxVolume(greetingAudioEl);
    greetingAudioEl.playbackRate = getLocalDevPlaybackRateMultiplier();
    greetingAudiblePlaybackActive = true;
    const playResult = greetingAudioEl.play();
    void playResult?.catch(() => {
      clearGreetingAudiblePlaybackActive();
    });
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
  if (openingGreetingSyncMode === 'web_speech' && typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    clearOpeningGreetingSyncState();
    clearGreetingAudiblePlaybackActive();
    return;
  }
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
  clearOpeningGreetingSyncState();
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
