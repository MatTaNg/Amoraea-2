import {
  applyAmoraeaPronunciation,
  applyAmoraeaPronunciationForDeviceSpeech,
  DEFAULT_ELEVENLABS_VOICE_ID,
  resolveElevenLabsVoiceId,
  sanitizeQuoteMarksForSpeech,
} from '../elevenLabsTtsVoice';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} },
  },
}));

describe('sanitizeQuoteMarksForSpeech', () => {
  it('removes dialogue single quotes but keeps contractions', () => {
    expect(
      sanitizeQuoteMarksForSpeech(
        "James is on a deadline, says 'that's amazing, let's celebrate tonight.'",
      ),
    ).toBe("James is on a deadline, says that's amazing, let's celebrate tonight.");
  });

  it('removes double quotes around dialogue', () => {
    expect(sanitizeQuoteMarksForSpeech('Emma says "I just think you always put your family first."')).toBe(
      'Emma says I just think you always put your family first.',
    );
  });
});

describe('applyAmoraeaPronunciation', () => {
  it('replaces amoraea case-insensitively', () => {
    expect(applyAmoraeaPronunciation('Welcome to Amoraea')).toBe('Welcome to Ah-mor-AY-ah');
    expect(applyAmoraeaPronunciation('AMORAEA is here')).toBe('Ah-mor-AY-ah is here');
  });

  it('leaves unrelated text unchanged', () => {
    expect(applyAmoraeaPronunciation('Hello world')).toBe('Hello world');
  });

  it('strips quote marks so TTS does not say apostrophe', () => {
    expect(
      applyAmoraeaPronunciation("James says 'hey don't cry, this is a good thing'."),
    ).toBe("James says hey don't cry, this is a good thing.");
  });
});

describe('applyAmoraeaPronunciationForDeviceSpeech', () => {
  it('uses spaced syllables instead of hyphens', () => {
    expect(applyAmoraeaPronunciationForDeviceSpeech("Hi, I'm Amoraea.")).toBe(
      "Hi, I'm Ah mor AY ah.",
    );
    expect(applyAmoraeaPronunciationForDeviceSpeech('Welcome to Ah-mor-AY-ah')).toBe(
      'Welcome to Ah mor AY ah',
    );
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
