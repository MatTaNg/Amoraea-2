import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@utilities/withRetry', () => ({
  classifyError: jest.fn(() => 'recoverable'),
}));

jest.mock('@utilities/networkRetry', () => ({
  runWithThreeAttemptsFixedBackoff: jest.fn(async ({ run }: { run: () => Promise<unknown> }) => run()),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} },
  },
}));

jest.mock('../elevenLabsTtsVoice', () => ({
  applyAmoraeaPronunciation: (text: string) => text,
  ELEVENLABS_VOICE_SETTINGS: {},
  resolveElevenLabsVoiceId: () => 'voice-id',
}));

jest.mock('../elevenLabsSpokenContext', () => ({
  takePreviousTextForElevenLabsRequest: jest.fn(() => undefined),
}));

jest.mock('../playElevenLabsPcmStreamPlayback', () => ({
  playElevenLabsPcmStreamFromResponse: jest.fn(async () => true),
}));

jest.mock('../elevenLabsTtsAvailability', () => ({
  isElevenLabsEnabledForEnvironment: jest.fn(() => false),
  isElevenLabsMp3FetchAllowedOnPlatform: jest.fn(() => true),
}));

jest.mock('../elevenLabsTtsCredentials', () => ({
  getElevenLabsApiKey: jest.fn(() => 'sk-test'),
  getTtsProxyUrl: jest.fn(() => ''),
  buildSupabaseEdgeFunctionAuthHeaders: jest.fn(async () => ({})),
}));

jest.mock('../webInterviewWebAudioContext', () => ({
  isWebInterviewAudioUnlocked: jest.fn(() => true),
}));

import { fetchElevenLabsMpegArrayBuffer } from '../elevenLabsTtsFetch';
import { isElevenLabsEnabledForEnvironment } from '../elevenLabsTtsAvailability';

describe('fetchElevenLabsMpegArrayBuffer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isElevenLabsEnabledForEnvironment as jest.Mock).mockReturnValue(false);
  });

  it('returns null for blank text', async () => {
    await expect(fetchElevenLabsMpegArrayBuffer('   ')).resolves.toBeNull();
  });

  it('returns null when ElevenLabs is disabled for environment', async () => {
    await expect(fetchElevenLabsMpegArrayBuffer('Hello')).resolves.toBeNull();
  });
});
