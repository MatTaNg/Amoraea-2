/**
 * Web-only: session-locked device denorm fields for `session_logs.event_data`.
 * Filled once when the interview session is initialized; merged into every `writeSessionLog`
 * call so events that are not `writeAudioSessionLog` (e.g. `response_received`, `recording_start`)
 * still include the same device_model / os / app / memory as `session_start`.
 * Native (iOS/Android) is unchanged: those paths rely on `setAudioSessionDeviceSnapshot` in the envelope.
 */

let sessionLocked: {
  device_model: string | null;
  os_version: string | null;
  app_version: string | null;
  available_memory_mb: number | null;
} | null = null;

export function captureWebSessionLogDeviceContext(p: {
  device_model: string | null;
  os_version: string | null;
  app_version: string | null;
  available_memory_mb: number | null;
}): void {
  sessionLocked = { ...p };
}

/** Used by `writeSessionLog` to denormalize web rows; returns nulls until capture runs. */
export function getWebSessionLogDeviceContextForMerge():
  | {
      device_model: string | null;
      os_version: string | null;
      app_version: string | null;
      available_memory_mb: number | null;
    }
  | null {
  return sessionLocked;
}

export function clearWebSessionLogDeviceContextForTests(): void {
  sessionLocked = null;
}
