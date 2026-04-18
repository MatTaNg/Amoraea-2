/**
 * Web: pre-authorize an HTMLAudioElement inside the mic-tap gesture (silent play → pause)
 * so ElevenLabs TTS can reuse it after long async work without losing autoplay permission.
 */
import { Platform } from 'react-native';

const SILENT_WAV_DATA_URL =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA==';

let preAuthorizedForNextTts: HTMLAudioElement | null = null;
let recordingStartShouldLogPreAuthorized = false;

/**
 * Call synchronously from the mic-tap handler before any await (start recording path).
 */
export function preAuthorizeAudioElementOnMicTapGesture(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const AudioCtor = (globalThis as unknown as { Audio?: new (src?: string) => HTMLAudioElement }).Audio;
  if (!AudioCtor) return;
  try {
    const el = new AudioCtor(SILENT_WAV_DATA_URL);
    el.setAttribute('playsinline', '');
    if ('playsInline' in el) {
      (el as { playsInline: boolean }).playsInline = true;
    }
    el.volume = 0.0001;
    void el
      .play()
      .then(() => {
        try {
          el.pause();
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
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
  try {
    el.volume = 0.0001;
    await el.play().catch(() => {});
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}
