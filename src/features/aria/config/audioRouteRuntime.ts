/**
 * Runtime audio route profile for VAD-adjacent tuning after route changes (not env-only).
 */
export type AudioRouteKind = 'builtin_mic' | 'headset_or_external' | 'unknown';

let routeKind: AudioRouteKind = 'unknown';

export function setAudioRouteKind(kind: AudioRouteKind): void {
  routeKind = kind;
}

export function getAudioRouteKind(): AudioRouteKind {
  return routeKind;
}

/** Added to speech metering min (dB); negative = treat quieter input as speech. */
export function getRouteSpeechMeteringDbOffset(): number {
  if (routeKind === 'builtin_mic') return -3;
  return 0;
}

/** Added to ambient noise ceiling (dB); lower ceiling = stricter silence. */
export function getRouteAmbientCeilingDbOffset(): number {
  if (routeKind === 'builtin_mic') return -2;
  return 0;
}
