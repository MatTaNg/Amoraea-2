/**
 * Web interview: user-gesture timestamps and gesture-context loss reasons for session telemetry.
 * Used by AriaScreen `tts_playback_start` / `tts_first_audio_play` — not for security decisions.
 */

export type GestureContextLostReason =
  | 'async_gap_in_tts_chain'
  | 'tab_visibility_change'
  | 'component_remount'
  | 'tts_called_from_effect'
  | 'unknown';

let lastUserGestureAtMs: number | null = null;
/** Mount generation when {@link markWebInterviewUserGestureNow} last ran. */
let lastGestureMountGeneration = 0;
let ariaScreenMountGeneration = 0;

let recordedLoss: { atMs: number; reason: GestureContextLostReason } | null = null;

export function bumpAriaScreenMountGeneration(): void {
  ariaScreenMountGeneration += 1;
}

export function getAriaScreenMountGeneration(): number {
  return ariaScreenMountGeneration;
}

export function markWebInterviewUserGestureNow(): void {
  lastUserGestureAtMs = Date.now();
  lastGestureMountGeneration = ariaScreenMountGeneration;
}

export function getLastWebInterviewUserGestureMs(): number | null {
  return lastUserGestureAtMs;
}

export function getLastGestureMountGeneration(): number {
  return lastGestureMountGeneration;
}

export function recordGestureContextLost(reason: GestureContextLostReason): void {
  recordedLoss = { atMs: Date.now(), reason };
}

export function consumeRecordedGestureContextLoss(): { atMs: number; reason: GestureContextLostReason } | null {
  const r = recordedLoss;
  recordedLoss = null;
  return r;
}

export function peekRecordedGestureContextLoss(): { atMs: number; reason: GestureContextLostReason } | null {
  return recordedLoss;
}

export function resetWebInterviewGestureContext(): void {
  lastUserGestureAtMs = null;
  lastGestureMountGeneration = 0;
  recordedLoss = null;
}
