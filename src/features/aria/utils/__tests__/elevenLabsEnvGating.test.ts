import { computeElevenLabsEnabled } from '../elevenLabsEnvGating';

describe('computeElevenLabsEnabled', () => {
  const env = (over: Record<string, string | undefined> = {}) => ({
    EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV: undefined as string | undefined,
    EXPO_PUBLIC_ELEVENLABS_TTS: undefined as string | undefined,
    ...over,
  });

  it('disables in dev bundle when no force flag', () => {
    expect(
      computeElevenLabsEnabled({
        isDevBundle: true,
        env: env(),
      })
    ).toBe(false);
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
