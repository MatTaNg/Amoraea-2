import { applyAmoraeaPronunciation, DEFAULT_ELEVENLABS_VOICE_ID, resolveElevenLabsVoiceId } from '../elevenLabsTtsVoice';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} },
  },
}));

describe('applyAmoraeaPronunciation', () => {
  it('replaces amoraea case-insensitively', () => {
    expect(applyAmoraeaPronunciation('Welcome to Amoraea')).toBe('Welcome to Ah-mor-AY-ah');
    expect(applyAmoraeaPronunciation('AMORAEA is here')).toBe('Ah-mor-AY-ah is here');
  });

  it('leaves unrelated text unchanged', () => {
    expect(applyAmoraeaPronunciation('Hello world')).toBe('Hello world');
  });
});

describe('resolveElevenLabsVoiceId', () => {
  const Constants = jest.requireMock('expo-constants').default;

  beforeEach(() => {
    Constants.expoConfig = { extra: {} };
    delete process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID;
  });

  it('defaults to Jessica voice id', () => {
    expect(resolveElevenLabsVoiceId()).toBe(DEFAULT_ELEVENLABS_VOICE_ID);
  });

  it('prefers expo extra elevenLabsVoiceId', () => {
    Constants.expoConfig = { extra: { elevenLabsVoiceId: 'custom-voice' } };
    expect(resolveElevenLabsVoiceId()).toBe('custom-voice');
  });

  it('falls back to EXPO_PUBLIC_ELEVENLABS_VOICE_ID', () => {
    process.env.EXPO_PUBLIC_ELEVENLABS_VOICE_ID = 'env-voice';
    expect(resolveElevenLabsVoiceId()).toBe('env-voice');
  });
});
