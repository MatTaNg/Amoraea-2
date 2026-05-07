/**
 * TTS playback vs estimate: match when actual is within **10% overrun** of expected
 * (same rule as `AriaScreen` telemetry `duration_match`).
 */
export function isTtsDurationMatchWithinOverrunTolerance(actualMs: number, expectedMs: number): boolean {
  return actualMs <= expectedMs * 1.1;
}

/** Below this expected duration, do not treat short playback as "premature cutoff" (avoids false positives on brief lines). */
export const TTS_PREMATURE_CUTOFF_MIN_EXPECTED_MS = 4000;

/** Actual/expected below this ⇒ likely truncated playback (PCM/HTML early end). */
export const TTS_PREMATURE_CUTOFF_RATIO = 0.8;

/**
 * True when playback ended far earlier than estimated speech length (truncated audio / dropped tail).
 * Ignores very short lines where the estimate is noisy.
 */
export function isTtsPlaybackPrematureCutoff(actualMs: number, expectedMs: number): boolean {
  if (!Number.isFinite(actualMs) || !Number.isFinite(expectedMs)) return false;
  if (expectedMs < TTS_PREMATURE_CUTOFF_MIN_EXPECTED_MS || expectedMs <= 0) return false;
  return actualMs / expectedMs < TTS_PREMATURE_CUTOFF_RATIO;
}
