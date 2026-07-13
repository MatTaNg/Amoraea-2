/**
 * Web: pre-authorize an HTMLAudioElement inside the mic-tap gesture (silent play → pause)
 * so ElevenLabs TTS can reuse it after long async work without losing autoplay permission.
 */
import { Platform } from 'react-native';

const SILENT_WAV_DATA_URL =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA==';

/** Interview TTS target level — restore after muted gesture priming. */
function restoreInterviewHtmlAudioVolume(el: HTMLAudioElement): void {
  try {
    el.volume = 1;
    el.muted = false;
  } catch {
    /* ignore */
  }
}

/** Muted silent play — unlocks autoplay without audible static on mobile speakers. */
function playMutedSilentHtmlAudioPriming(el: HTMLAudioElement, src?: string): void {
  try {
    if (src) el.src = src;
    el.muted = true;
    el.volume = 1;
    void el
      .play()
      .then(() => {
        try {
          el.pause();
          el.currentTime = 0;
          restoreInterviewHtmlAudioVolume(el);
        } catch {
          restoreInterviewHtmlAudioVolume(el);
        }
      })
      .catch(() => {
        restoreInterviewHtmlAudioVolume(el);
      });
  } catch {
    restoreInterviewHtmlAudioVolume(el);
  }
}

let preAuthorizedForNextTts: HTMLAudioElement | null = null;
let recordingStartShouldLogPreAuthorized = false;

/**
 * Call synchronously from the mic-tap handler before any await (start recording path).
 */
export function preAuthorizeAudioElementOnMicTapGesture(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { isWebInterviewMidUtteranceTabResumeActive } =
    require('./webInterviewHtmlAudioTabResume') as typeof import('./webInterviewHtmlAudioTabResume');
  if (isWebInterviewMidUtteranceTabResumeActive()) return;
  const AudioCtor = (globalThis as unknown as { Audio?: new (src?: string) => HTMLAudioElement }).Audio;
  if (!AudioCtor) return;
  try {
    const el = new AudioCtor(SILENT_WAV_DATA_URL);
    el.setAttribute('playsinline', '');
    if ('playsInline' in el) {
      (el as { playsInline: boolean }).playsInline = true;
    }
    playMutedSilentHtmlAudioPriming(el, SILENT_WAV_DATA_URL);
    preAuthorizedForNextTts = el;
    recordingStartShouldLogPreAuthorized = true;
  } catch {
    /* ignore */
  }
}

export function isPreAuthorizedAudioPendingForNextTts(): boolean {
  return preAuthorizedForNextTts != null;
}

/**
 * Consumes the pre-authorized element for ElevenLabs HTML playback (one turn).
 */
export function takePreAuthorizedAudioElementForTts(): HTMLAudioElement | null {
  const el = preAuthorizedForNextTts;
  preAuthorizedForNextTts = null;
  if (el) restoreInterviewHtmlAudioVolume(el);
  return el;
}

export function takeRecordingStartPreauthorizedFlag(): boolean {
  const v = recordingStartShouldLogPreAuthorized;
  recordingStartShouldLogPreAuthorized = false;
  return v;
}

/**
 * Silent play/pause on the pending pre-authorized element after the tab is visible again.
 * Does not consume the element — call before `takePreAuthorizedAudioElementForTts` in the same turn.
 */
export async function reauthorizePendingPreAuthorizedElement(): Promise<void> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.visibilityState !== 'visible') return;
  const el = preAuthorizedForNextTts;
  if (!el) return;
  playMutedSilentHtmlAudioPriming(el);
}

/** Refresh or create pre-authorized HTML audio before TTS after a long async processing gap. */
export async function refreshPreAuthorizedAudioForLongProcessingGap(): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  if (preAuthorizedForNextTts) {
    await reauthorizePendingPreAuthorizedElement();
    return true;
  }
  preAuthorizeAudioElementOnMicTapGesture();
  return preAuthorizedForNextTts != null;
}
