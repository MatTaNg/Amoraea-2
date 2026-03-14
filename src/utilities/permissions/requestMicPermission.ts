/**
 * Request microphone permission on a user gesture (e.g. "Start" or "Ready" tap).
 * On iOS PWA (standalone), the permission prompt may not appear until we explicitly
 * call getUserMedia. Call this before the first recording attempt.
 */
export async function requestMicPermissionForPWA(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      },
    });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') return false;
    return false;
  }
}
