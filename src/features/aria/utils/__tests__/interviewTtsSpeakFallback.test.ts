import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('../elevenLabsTtsPlaybackStop', () => ({
  stopElevenLabsPlayback: jest.fn(async () => undefined),
}));

jest.mock('../interviewWebSpeechSynthesis', () => ({
  speakWithWebSpeechSynthesis: jest.fn(async () => ({ ok: true })),
}));

jest.mock('../interviewTtsPlaybackRate', () => ({
  getEffectivePlaybackRateMultiplier: jest.fn(() => 1),
  getLocalDevPlaybackRateMultiplier: jest.fn(() => 1),
}));

jest.mock('../webSpeechDeferPolicy', () => ({
  webSpeechShouldDeferToUserGesture: jest.fn(() => false),
}));

import { speakFallback } from '../interviewTtsSpeakFallback';
import { stopElevenLabsPlayback } from '../elevenLabsTtsPlaybackStop';
import { speakWithWebSpeechSynthesis } from '../interviewWebSpeechSynthesis';
import { WebTtsRequiresUserGestureError } from '../webTtsGestureErrors';

describe('speakFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses web speech synthesis on web', async () => {
    await speakFallback('Hello there');
    expect(stopElevenLabsPlayback).toHaveBeenCalled();
    expect(speakWithWebSpeechSynthesis).toHaveBeenCalledWith(
      'Hello there',
      undefined,
      'tts_playback',
      expect.any(Number),
    );
  });

  it('throws when web speech fails instead of silently resolving', async () => {
    jest.mocked(speakWithWebSpeechSynthesis).mockResolvedValueOnce({
      ok: false,
      error: 'synthesis-failed',
    });
    await expect(speakFallback('Long scenario vignette text')).rejects.toBeInstanceOf(
      WebTtsRequiresUserGestureError,
    );
  });
});
