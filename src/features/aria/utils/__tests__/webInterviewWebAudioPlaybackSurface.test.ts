import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  assignActiveWebBufferSource,
  bumpWebInterviewTtsScheduleEpoch,
  captureWebInterviewTtsScheduleEpoch,
  clearActiveWebBufferSourceIfMatches,
  hasActiveWebBufferOrPcmPlayback,
  isExtraWebInterviewPlaybackSurfaceActive,
  registerActivePcmStreamSource,
  registerExtraWebInterviewPlaybackHooks,
  resetWebInterviewWebAudioPlaybackSurface,
  stopActiveWebBufferAndPcmPlayback,
  unregisterActivePcmStreamSource,
} from '@features/aria/utils/webInterviewWebAudioPlaybackSurface';

describe('webInterviewWebAudioPlaybackSurface', () => {
  beforeEach(() => {
    resetWebInterviewWebAudioPlaybackSurface();
  });

  it('tracks schedule epoch staleness across bumps', () => {
    const epoch = captureWebInterviewTtsScheduleEpoch();
    expect(epoch.isStale()).toBe(false);
    bumpWebInterviewTtsScheduleEpoch();
    expect(epoch.isStale()).toBe(true);
  });

  it('tracks and clears active buffer sources', () => {
    const src = { stop: jest.fn() } as unknown as AudioBufferSourceNode;
    assignActiveWebBufferSource(src);
    expect(hasActiveWebBufferOrPcmPlayback()).toBe(true);
    clearActiveWebBufferSourceIfMatches(src);
    expect(hasActiveWebBufferOrPcmPlayback()).toBe(false);
  });

  it('stops buffer and PCM sources on hard teardown', () => {
    const bufferStop = jest.fn();
    const pcmStop = jest.fn();
    assignActiveWebBufferSource({ stop: bufferStop } as unknown as AudioBufferSourceNode);
    registerActivePcmStreamSource({ stop: pcmStop } as unknown as AudioBufferSourceNode);

    stopActiveWebBufferAndPcmPlayback();

    expect(bufferStop).toHaveBeenCalledWith(0);
    expect(pcmStop).toHaveBeenCalledWith(0);
    expect(hasActiveWebBufferOrPcmPlayback()).toBe(false);
  });

  it('registers extra playback hook activity', () => {
    const isActive = jest.fn(() => true);
    registerExtraWebInterviewPlaybackHooks({ isActive });
    expect(isExtraWebInterviewPlaybackSurfaceActive()).toBe(true);
    unregisterActivePcmStreamSource({} as AudioBufferSourceNode);
    registerExtraWebInterviewPlaybackHooks({});
    expect(isExtraWebInterviewPlaybackSurfaceActive()).toBe(false);
  });
});
