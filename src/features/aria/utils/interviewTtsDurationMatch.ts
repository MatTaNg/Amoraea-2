/**
 * TTS playback vs estimate: match when actual is within **10% overrun** of expected
 * (same rule as `AriaScreen` telemetry `duration_match`).
 */
export function isTtsDurationMatchWithinOverrunTolerance(actualMs: number, expectedMs: number): boolean {
  return actualMs <= expectedMs * 1.1;
}
