import { Platform } from 'react-native';

import {
  logTtsAutoplayPlayOutcome,
  type TtsTelemetrySource,
} from '@features/aria/telemetry/tsAutoplayTelemetry';

/** After `unlockWebInterviewSharedAudioContext()` runs in a tap handler — primes AudioContext (silent tick). */
let sharedWebAudioContext: AudioContext | null = null;

/**
 * Web interview session: true only after a successful unlock in this session.
 * TTS must not run until set — avoids WEB_TTS_GESTURE when autoplay unlock never ran in a user gesture.
 */
let webInterviewAudioUnlocked = false;

export function getSharedWebAudioContext(): AudioContext | null {
  return sharedWebAudioContext;
}

export function isWebInterviewAudioUnlocked(): boolean {
  return Platform.OS !== 'web' || webInterviewAudioUnlocked;
}

/**
 * Call **synchronously** from a real user gesture (Start interview, mic `onPressIn`, mic permission, etc.).
 * Creates/resumes a shared `AudioContext` and plays a minimal silent buffer so later MP3 playback via
 * `decodeAudioData` + `AudioBufferSourceNode` is allowed without another tap.
 */
export function unlockWebInterviewSharedAudioContext(onUnlocked?: () => void): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!sharedWebAudioContext) {
      sharedWebAudioContext = new AC();
    }
    void sharedWebAudioContext.resume();
    const ctx = sharedWebAudioContext;
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    webInterviewAudioUnlocked = true;
    onUnlocked?.();
  } catch {
    /* ignore — TTS will throw WebTtsRequiresUserGestureError until a successful unlock */
  }
}

/**
 * Safari and some browsers suspend `AudioContext` when the tab is hidden. Call before web playback
 * (and after any await) so TTS does not fail with autoplay/gesture errors on the next line.
 */
export async function ensureSharedWebAudioContextResumedForPlayback(
  telemetrySource: TtsTelemetrySource,
): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  const ctx = sharedWebAudioContext;
  if (!ctx || !webInterviewAudioUnlocked) return true;
  if (ctx.state === 'closed') return false;
  /** `resume()` is a no-op when already `running`; call for `suspended` and any other non-running state. */
  if (ctx.state === 'running') return true;
  try {
    await Promise.race([
      ctx.resume(),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('resume-timeout')), 5000);
      }),
    ]);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logTtsAutoplayPlayOutcome({
      pipeline: 'elevenlabs_web_audio_context',
      outcome: 'play_error',
      telemetrySource,
      errorName: 'resume',
      errorMessagePreview: msg.slice(0, 120),
    });
    return false;
  }
}

/** Suspend shared AudioContext when the tab hides so background tabs do not advance decoded audio silently. */
export function suspendSharedWebAudioContextForTabHide(): void {
  if (Platform.OS !== 'web') return;
  const ctx = sharedWebAudioContext;
  if (!ctx || ctx.state === 'closed') return;
  if (ctx.state === 'running') {
    void ctx.suspend().catch(() => {});
  }
}

export function resetWebInterviewWebAudioContext(): void {
  webInterviewAudioUnlocked = false;
  sharedWebAudioContext = null;
}
