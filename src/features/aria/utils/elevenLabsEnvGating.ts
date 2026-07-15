function parseEnvBool(v: string | undefined): boolean | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes') return true;
  if (s === '0' || s === 'false' || s === 'no') return false;
  return undefined;
}

export type ElevenLabsEnvKeys = {
  EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV?: string;
  EXPO_PUBLIC_ELEVENLABS_TTS?: string;
  EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK?: string;
};

/**
 * Pure gate for ElevenLabs TTS — test with explicit `isDevBundle` instead of mutating `__DEV__`.
 * Production/release: enabled when configured; dev bundle: off unless `EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV` forces on.
 */
export function computeElevenLabsEnabled(options: {
  isDevBundle: boolean;
  env: ElevenLabsEnvKeys;
  /** When set in dev, allow ElevenLabs via Supabase edge proxy without a client API key. */
  ttsProxyUrl?: string;
}): boolean {
  const forceInDev = parseEnvBool(options.env.EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV);
  if (forceInDev === true) return true;

  if (options.isDevBundle) {
    return Boolean(options.ttsProxyUrl?.trim());
  }

  const explicit = parseEnvBool(options.env.EXPO_PUBLIC_ELEVENLABS_TTS);
  if (explicit === false) return false;
  return true;
}

/**
 * iOS native: warm ElevenLabs Jessica MP3 by default (`expo-av` + playback mode before TTS).
 * Set `EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK=0` to fall back to expo-speech (robotic).
 */
export function computeIosUseElevenLabsMp3Playback(env: {
  EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK?: string;
}): boolean {
  const explicit = parseEnvBool(env.EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK);
  if (explicit === false) return false;
  return true;
}
