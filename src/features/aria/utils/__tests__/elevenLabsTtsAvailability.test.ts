import { iosUseElevenLabsMp3Playback, isElevenLabsEnabledForEnvironment, isElevenLabsMp3FetchAllowedOnPlatform } from '../elevenLabsTtsAvailability';
import { setInterviewTtsSessionEmail } from '../interviewTtsDevAccount';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

jest.mock('../elevenLabsTtsCredentials', () => ({
  getTtsProxyUrl: jest.fn(() => ''),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

describe('elevenLabsTtsAvailability', () => {
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;

  afterEach(() => {
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
    setInterviewTtsSessionEmail(null);
    delete process.env.EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV;
    delete process.env.EXPO_PUBLIC_ELEVENLABS_TTS;
    delete process.env.EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK;
  });

  it('disables ElevenLabs in dev bundle by default', () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;
    expect(isElevenLabsEnabledForEnvironment()).toBe(false);
  });

  it('enables ElevenLabs for configured dev accounts on production builds when env allows', () => {
    (global as { __DEV__?: boolean }).__DEV__ = false;
    process.env.EXPO_PUBLIC_ELEVENLABS_TTS = '1';
    setInterviewTtsSessionEmail('ng5280@hotmail.com');
    expect(isElevenLabsEnabledForEnvironment()).toBe(true);
  });

  it('disables ElevenLabs for configured dev accounts in dev bundle', () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;
    process.env.EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV = '1';
    setInterviewTtsSessionEmail('ng5280@hotmail.com');
    expect(isElevenLabsEnabledForEnvironment()).toBe(false);
  });

  it('allows iOS MP3 fetch by default; opt-out via env', () => {
    expect(iosUseElevenLabsMp3Playback()).toBe(true);
    expect(isElevenLabsMp3FetchAllowedOnPlatform()).toBe(true);
    process.env.EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK = '0';
    expect(iosUseElevenLabsMp3Playback()).toBe(false);
    expect(isElevenLabsMp3FetchAllowedOnPlatform()).toBe(false);
  });
});
