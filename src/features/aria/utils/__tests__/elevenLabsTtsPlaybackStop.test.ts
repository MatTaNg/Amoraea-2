import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-speech', () => ({
  stop: jest.fn(),
}));

jest.mock('../webInterviewHtmlAudioTabRestoreOrchestration', () => ({
  clearHtmlAudioTabResumeState: jest.fn(),
}));

jest.mock('../webInterviewActiveHtmlAudio', () => ({
  getActiveWebHtmlAudioRef: jest.fn(() => null),
  getActiveWebHtmlAudioObjectUrl: jest.fn(() => null),
  clearActiveWebHtmlAudio: jest.fn(),
  assignActiveWebHtmlAudioObjectUrl: jest.fn(),
}));

jest.mock('../webInterviewWebAudioPlaybackSurface', () => ({
  stopExtraWebInterviewPlaybackHooks: jest.fn(),
  bumpWebInterviewTtsScheduleEpoch: jest.fn(),
  stopActiveWebBufferAndPcmPlayback: jest.fn(),
}));

jest.mock('../webInterviewPendingGestureBlob', () => ({
  revokePendingWebGestureBlobUrlUnlessTabStash: jest.fn(),
}));

jest.mock('../webInterviewTabRestoreStash', () => ({
  getWebInterviewTabRestoreStash: jest.fn(() => null),
}));

jest.mock('../nativeElevenLabsMp3Playback', () => ({
  stopNativeElevenLabsMp3Playback: jest.fn(async () => undefined),
}));

import { stopElevenLabsPlayback, stopElevenLabsSpeech } from '../elevenLabsTtsPlaybackStop';
import { stopNativeElevenLabsMp3Playback } from '../nativeElevenLabsMp3Playback';

describe('elevenLabsTtsPlaybackStop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stopElevenLabsSpeech delegates to stopElevenLabsPlayback', async () => {
    stopElevenLabsSpeech();
    await Promise.resolve();
    expect(stopNativeElevenLabsMp3Playback).toHaveBeenCalled();
  });

  it('stopElevenLabsPlayback stops native sound on non-web', async () => {
    await stopElevenLabsPlayback();
    expect(stopNativeElevenLabsMp3Playback).toHaveBeenCalled();
  });
});
