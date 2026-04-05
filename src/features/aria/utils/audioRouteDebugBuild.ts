/**
 * Bump when changing audio-route NDJSON instrumentation or related native audio code.
 * Shown on the intro screen and in every debug ingest payload as `debugBuild`.
 */
export const AUDIO_ROUTE_DEBUG_BUILD = 'audio-route-debug-24';

export function withAudioRouteDebugBuild<T extends Record<string, unknown>>(
  payload: T
): T & { debugBuild: string } {
  return { ...payload, debugBuild: AUDIO_ROUTE_DEBUG_BUILD };
}
