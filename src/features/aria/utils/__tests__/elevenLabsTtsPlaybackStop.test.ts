import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('expo-speech', () => ({
  stop: jest.fn(),
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

  it('stopElevenLabsPlayback stops native sound', async () => {
    await stopElevenLabsPlayback();
    expect(stopNativeElevenLabsMp3Playback).toHaveBeenCalled();
  });
});
