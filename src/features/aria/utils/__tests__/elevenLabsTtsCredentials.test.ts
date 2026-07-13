import {
  getElevenLabsApiKey,
  getResolvedSupabaseUrl,
  getTtsProxyUrl,
} from '../elevenLabsTtsCredentials';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} },
  },
}));

jest.mock('@data/supabase/client', () => ({
  supabase: {},
}));

describe('elevenLabsTtsCredentials', () => {
  const Constants = jest.requireMock('expo-constants').default;

  beforeEach(() => {
    Constants.expoConfig = { extra: {} };
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_ELEVENLABS_TTS_PROXY_URL;
    delete process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
  });

  describe('getResolvedSupabaseUrl', () => {
    it('reads EXPO_PUBLIC_SUPABASE_URL and strips trailing slashes', () => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co///';
      expect(getResolvedSupabaseUrl()).toBe('https://proj.supabase.co');
    });

    it('falls back to expo extra supabaseUrl', () => {
      Constants.expoConfig = { extra: { supabaseUrl: 'https://extra.supabase.co' } };
      expect(getResolvedSupabaseUrl()).toBe('https://extra.supabase.co');
    });
  });

  describe('getTtsProxyUrl', () => {
    it('returns explicit proxy URL when set', () => {
      process.env.EXPO_PUBLIC_ELEVENLABS_TTS_PROXY_URL = 'https://custom/proxy';
      expect(getTtsProxyUrl()).toBe('https://custom/proxy');
    });

    it('derives proxy from supabase URL when no explicit proxy', () => {
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
      expect(getTtsProxyUrl()).toBe('https://proj.supabase.co/functions/v1/elevenlabs-tts-proxy');
    });
  });

  describe('getElevenLabsApiKey', () => {
    it('reads API key from process env', () => {
      process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY = 'sk-test';
      expect(getElevenLabsApiKey()).toBe('sk-test');
    });

    it('reads API key from expo extra', () => {
      Constants.expoConfig = { extra: { elevenLabsApiKey: 'sk-extra' } };
      expect(getElevenLabsApiKey()).toBe('sk-extra');
    });
  });
});
