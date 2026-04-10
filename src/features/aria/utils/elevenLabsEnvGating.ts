function parseEnvBool(v: string | undefined): boolean | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'no') return false;
  return undefined;
}

export type ElevenLabsEnvKeys = {
  EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV?: string;
  EXPO_PUBLIC_ELEVENLABS_TTS?: string;
};

/**
 * Pure gate for ElevenLabs TTS — test with explicit `isDevBundle` instead of mutating `__DEV__`.
 * Production/release: enabled when configured; dev bundle: off unless `EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV` forces on.
 */
export function computeElevenLabsEnabled(options: {
  isDevBundle: boolean;
  env: ElevenLabsEnvKeys;
}): boolean {
  const forceInDev = parseEnvBool(options.env.EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV);
  if (forceInDev === true) return true;

  if (options.isDevBundle) return false;

  const explicit = parseEnvBool(options.env.EXPO_PUBLIC_ELEVENLABS_TTS);
  if (explicit === false) return false;
  return true;
}
