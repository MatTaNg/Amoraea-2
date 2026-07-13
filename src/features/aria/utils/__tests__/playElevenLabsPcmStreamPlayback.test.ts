import { describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/utils/webInterviewWebAudioContext', () => ({
  getSharedWebAudioContext: jest.fn(() => ({ createBuffer: jest.fn() })),
  isWebInterviewAudioUnlocked: jest.fn(() => true),
  ensureSharedWebAudioContextResumedForPlayback: jest.fn(async () => true),
}));

jest.mock('@features/aria/utils/webInterviewMicPreInit', () => ({
  finalizeInterviewMicAmbientOnTtsEnd: jest.fn(),
}));

jest.mock('@utilities/sessionLogging/sessionLogContext', () => ({
  getSessionLogRuntime: jest.fn(() => null),
}));

import { playElevenLabsPcmStreamFromResponse } from '@features/aria/utils/playElevenLabsPcmStreamPlayback';

describe('playElevenLabsPcmStreamFromResponse', () => {
  it('returns false when response has no body', async () => {
    await expect(
      playElevenLabsPcmStreamFromResponse(
        new Response(null),
        undefined,
        'turn',
        'tts_playback',
      ),
    ).resolves.toBe(false);
  });
});
