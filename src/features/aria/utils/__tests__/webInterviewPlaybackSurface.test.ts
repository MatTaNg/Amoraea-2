import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/utils/webInterviewActiveHtmlAudio', () => ({
  getActiveWebHtmlAudioElement: jest.fn(() => null),
  getActiveWebHtmlAudioRef: jest.fn(() => null),
}));

jest.mock('@features/aria/utils/webInterviewHtmlAudioTabResume', () => ({
  getTabStashedHtmlAudioElement: jest.fn(() => null),
}));

jest.mock('@features/aria/utils/webInterviewWebAudioPlaybackSurface', () => ({
  hasActiveWebBufferOrPcmPlayback: jest.fn(() => false),
  isExtraWebInterviewPlaybackSurfaceActive: jest.fn(() => false),
}));

import { getActiveWebHtmlAudioRef } from '@features/aria/utils/webInterviewActiveHtmlAudio';
import { hasActiveWebBufferOrPcmPlayback } from '@features/aria/utils/webInterviewWebAudioPlaybackSurface';
import { isWebInterviewPlaybackSurfaceActive } from '@features/aria/utils/webInterviewPlaybackSurface';

describe('webInterviewPlaybackSurface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { speechSynthesis: { speaking: false } },
    });
  });

  it('returns true when HTML audio ref is active', () => {
    jest.mocked(getActiveWebHtmlAudioRef).mockReturnValue({
      pause: jest.fn(),
      currentTime: 0,
    });
    expect(isWebInterviewPlaybackSurfaceActive()).toBe(true);
  });

  it('returns true when Web Audio buffer or PCM playback is active', () => {
    jest.mocked(hasActiveWebBufferOrPcmPlayback).mockReturnValue(true);
    expect(isWebInterviewPlaybackSurfaceActive()).toBe(true);
  });
});
