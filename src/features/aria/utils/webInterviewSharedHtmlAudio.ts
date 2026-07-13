import { Platform } from 'react-native';

import { webSpeechShouldDeferToUserGesture } from './webSpeechDeferPolicy';
import { ensureWebHtmlAudioElementMaxVolume } from './webInterviewHtmlAudioVolume';

/** Minimal silent WAV — unlocks shared HTML audio in the mic-stop gesture stack. */
const SILENT_WAV_DATA_URL =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA==';

/**
 * Shared element for mobile web MP3: primed with `primeHtmlAudioForMobileTtsFromMicGesture` (mic release / press)
 * so `play()` after async ElevenLabs fetch is not blocked as a new gesture.
 */
let sharedHtmlAudioForMobileTts: HTMLAudioElement | null = null;

let getActiveWebHtmlAudioForSharedPriming: () => HTMLAudioElement | null = () => null;

export function bindWebInterviewSharedHtmlAudioActiveElement(
  getter: () => HTMLAudioElement | null,
): void {
  getActiveWebHtmlAudioForSharedPriming = getter;
}

export function getSharedHtmlAudioForMobileTts(): HTMLAudioElement | null {
  return sharedHtmlAudioForMobileTts;
}

export function hasSharedHtmlAudioForInterviewTts(): boolean {
  return sharedHtmlAudioForMobileTts !== null;
}

/** Shared mobile-web `<audio>` for interview TTS — reused across parallel-stream chunks. */
export function ensureSharedHtmlAudioElementForInterviewTts(): HTMLAudioElement | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const AudioCtor = (globalThis as unknown as { Audio?: new (src?: string) => HTMLAudioElement }).Audio;
  if (!AudioCtor) return null;
  if (!sharedHtmlAudioForMobileTts) {
    sharedHtmlAudioForMobileTts = new AudioCtor();
    const el = sharedHtmlAudioForMobileTts;
    el.setAttribute('playsinline', '');
    if ('playsInline' in el) {
      (el as { playsInline: boolean }).playsInline = true;
    }
    el.preload = 'auto';
    ensureWebHtmlAudioElementMaxVolume(el);
  }
  return sharedHtmlAudioForMobileTts;
}

/**
 * Call synchronously from the same user-gesture stack as mic stop (`onBeforeWebRecorderStop`) or mic press.
 * Plays a silent clip on a shared `HTMLAudioElement` so a later async MP3 `play()` is allowed without an extra tap.
 */
export function primeHtmlAudioForMobileTtsFromMicGesture(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!webSpeechShouldDeferToUserGesture()) return;
  try {
    const el = ensureSharedHtmlAudioElementForInterviewTts();
    if (!el) return;
    el.src = SILENT_WAV_DATA_URL;
    try {
      el.muted = true;
      el.volume = 1;
      void el
        .play()
        .then(() => {
          try {
            el.pause();
            el.currentTime = 0;
            ensureWebHtmlAudioElementMaxVolume(el);
          } catch {
            /* ignore */
          }
        })
        .catch(() => {
          ensureWebHtmlAudioElementMaxVolume(el);
        });
    } catch {
      ensureWebHtmlAudioElementMaxVolume(el);
    }
  } catch {
    /* ignore */
  }
}

/** Silent tick on the shared HTMLAudio element — does not replace `src` while that element is playing real TTS. */
export function reprimeSharedHtmlAudioSilentPlay(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!sharedHtmlAudioForMobileTts) return;
  const activeWebAudio = getActiveWebHtmlAudioForSharedPriming();
  try {
    if (activeWebAudio === sharedHtmlAudioForMobileTts && !sharedHtmlAudioForMobileTts.paused) {
      return;
    }
    sharedHtmlAudioForMobileTts.src = SILENT_WAV_DATA_URL;
    sharedHtmlAudioForMobileTts.muted = true;
    sharedHtmlAudioForMobileTts.volume = 1;
    void sharedHtmlAudioForMobileTts
      .play()
      .then(() => {
        try {
          if (getActiveWebHtmlAudioForSharedPriming() !== sharedHtmlAudioForMobileTts) {
            sharedHtmlAudioForMobileTts?.pause();
            if (sharedHtmlAudioForMobileTts) {
              sharedHtmlAudioForMobileTts.currentTime = 0;
              ensureWebHtmlAudioElementMaxVolume(sharedHtmlAudioForMobileTts);
            }
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        if (sharedHtmlAudioForMobileTts) ensureWebHtmlAudioElementMaxVolume(sharedHtmlAudioForMobileTts);
      });
  } catch {
    /* ignore */
  }
}

export function resetWebInterviewSharedHtmlAudio(): void {
  if (sharedHtmlAudioForMobileTts) {
    try {
      sharedHtmlAudioForMobileTts.pause();
      sharedHtmlAudioForMobileTts.src = '';
    } catch {
      /* ignore */
    }
    sharedHtmlAudioForMobileTts = null;
  }
}
