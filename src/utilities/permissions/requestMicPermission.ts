import { buildWebMicGetUserMediaConstraints } from '@features/aria/utils/webMicDeviceConstraints';

/**
 * Interview start (web): request mic with minimal constraints in the same user-gesture stack as "Start".
 * Stops tracks immediately — goal is permission + gesture context before greeting TTS, not holding a stream.
 */
export async function requestMicrophonePermissionForInterviewStart(): Promise<{
  ok: boolean;
  errorName: string | null;
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { ok: true, errorName: null };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true, errorName: null };
  } catch (err) {
    const name = err instanceof Error ? err.name : 'UnknownError';
    return { ok: false, errorName: name };
  }
}

/**
 * Request microphone permission on a user gesture (e.g. "Start" or "Ready" tap).
 * On iOS PWA (standalone), the permission prompt may not appear until we explicitly
 * call getUserMedia. Call this before the first recording attempt.
 */
export async function requestMicPermissionForPWA(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return true;
  try {
    const constraints = await buildWebMicGetUserMediaConstraints();
    const baseAudio = constraints.audio;
    const audio =
      typeof baseAudio === 'object' && baseAudio !== null && !Array.isArray(baseAudio)
        ? { ...baseAudio, sampleRate: 44100 }
        : { sampleRate: 44100, echoCancellation: true, noiseSuppression: true };
    const stream = await navigator.mediaDevices.getUserMedia({ audio });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') return false;
    return false;
  }
}
