import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/utils/webInterviewWebAudioContext', () => ({
  getSharedWebAudioContext: jest.fn(() => null),
  isWebInterviewAudioUnlocked: jest.fn(() => false),
  ensureSharedWebAudioContextResumedForPlayback: jest.fn(async () => true),
}));

jest.mock('@features/aria/utils/webInterviewMicPreInit', () => ({
  finalizeInterviewMicAmbientOnTtsEnd: jest.fn(),
}));

jest.mock('@utilities/sessionLogging/sessionLogContext', () => ({
  getSessionLogRuntime: jest.fn(() => null),
}));

import { tryPlayElevenLabsMp3WithWebAudio } from '@features/aria/utils/playElevenLabsMp3WithWebAudio';

describe('tryPlayElevenLabsMp3WithWebAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false when web audio is not unlocked', async () => {
    await expect(
      tryPlayElevenLabsMp3WithWebAudio(new ArrayBuffer(8), undefined, 'turn', 'tts_playback'),
    ).resolves.toBe(false);
  });
});
