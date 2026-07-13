import { computeElevenLabsEnabled, computeIosUseElevenLabsMp3Playback } from '../elevenLabsEnvGating';

describe('computeElevenLabsEnabled', () => {
  const env = (over: Record<string, string | undefined> = {}) => ({
    EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV: undefined as string | undefined,
    EXPO_PUBLIC_ELEVENLABS_TTS: undefined as string | undefined,
    ...over,
  });

  it('disables in dev bundle when no force flag or proxy', () => {
    expect(
      computeElevenLabsEnabled({
        isDevBundle: true,
        env: env(),
      })
    ).toBe(false);
  });

  it('enables in dev when a TTS proxy URL is configured', () => {
    expect(
      computeElevenLabsEnabled({
        isDevBundle: true,
        env: env(),
        ttsProxyUrl: 'https://example.supabase.co/functions/v1/elevenlabs-tts-proxy',
      })
    ).toBe(true);
  });

  it('enables in dev when EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV is truthy', () => {
    expect(
      computeElevenLabsEnabled({
        isDevBundle: true,
        env: env({ EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV: '1' }),
      })
    ).toBe(true);
  });

  it('enables in release when not explicitly disabled', () => {
    expect(
      computeElevenLabsEnabled({
        isDevBundle: false,
        env: env(),
      })
    ).toBe(true);
  });

  it('disables in release when EXPO_PUBLIC_ELEVENLABS_TTS=0', () => {
    expect(
      computeElevenLabsEnabled({
        isDevBundle: false,
        env: env({ EXPO_PUBLIC_ELEVENLABS_TTS: '0' }),
      })
    ).toBe(false);
  });

  it('enables in release when EXPO_PUBLIC_ELEVENLABS_TTS=1', () => {
    expect(
      computeElevenLabsEnabled({
        isDevBundle: false,
        env: env({ EXPO_PUBLIC_ELEVENLABS_TTS: 'true' }),
      })
    ).toBe(true);
  });
});

describe('computeIosUseElevenLabsMp3Playback', () => {
  it('defaults to false when unset', () => {
    expect(computeIosUseElevenLabsMp3Playback({})).toBe(false);
  });

  it('enables when EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK is truthy', () => {
    expect(
      computeIosUseElevenLabsMp3Playback({ EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK: '1' }),
    ).toBe(true);
    expect(
      computeIosUseElevenLabsMp3Playback({ EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK: 'true' }),
    ).toBe(true);
  });

  it('stays false for explicit disable values', () => {
    expect(
      computeIosUseElevenLabsMp3Playback({ EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK: '0' }),
    ).toBe(false);
  });
});
