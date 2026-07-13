import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('../elevenLabsTtsFetch', () => ({
  fetchElevenLabsMpegArrayBuffer: jest.fn(async () => null),
  tryPlayElevenLabsPcmStream: jest.fn(async () => false),
}));

jest.mock('../playElevenLabsMp3WithWebAudio', () => ({
  tryPlayElevenLabsMp3WithWebAudio: jest.fn(async () => false),
}));

jest.mock('../playElevenLabsMp3WithWebHtmlAudio', () => ({
  playElevenLabsMp3WithWebHtmlAudio: jest.fn(async () => undefined),
}));

jest.mock('../webInterviewWebPlaybackPriming', () => ({
  ensureWebPlaybackPrimedForNextTurn: jest.fn(async () => undefined),
  shouldSkipSilentReprimeForTelemetry: jest.fn(() => false),
}));

jest.mock('../webSpeechDeferPolicy', () => ({
  webSpeechShouldDeferToUserGesture: jest.fn(() => true),
}));

jest.mock('../webInterviewTtsBrowserGuards', () => ({
  shouldDiscourageElevenLabsPcmStreamOnWeb: jest.fn(() => true),
}));

jest.mock('../elevenLabsSpokenContext', () => ({
  recordElevenLabsSpokenContext: jest.fn(),
}));

import { fetchElevenLabsMpegArrayBuffer } from '../elevenLabsTtsFetch';
import { playElevenLabsMp3WithWebHtmlAudio } from '../playElevenLabsMp3WithWebHtmlAudio';
import { speakElevenLabsWebMp3 } from '../speakElevenLabsWebMp3';

describe('speakElevenLabsWebMp3', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns fallback when MP3 fetch fails', async () => {
    await expect(
      speakElevenLabsWebMp3({
        text: 'Hello',
        spokenText: 'Hello',
        telemetrySource: 'turn',
        preInitTriggerDuring: 'tts_playback',
        playbackRateMultiplier: 1,
      }),
    ).resolves.toBe('fallback');
    expect(fetchElevenLabsMpegArrayBuffer).toHaveBeenCalledWith('Hello');
    expect(playElevenLabsMp3WithWebHtmlAudio).not.toHaveBeenCalled();
  });

  it('plays via HTML audio when fetch succeeds', async () => {
    (fetchElevenLabsMpegArrayBuffer as jest.Mock).mockResolvedValue(new ArrayBuffer(16));
    await expect(
      speakElevenLabsWebMp3({
        text: 'Hello',
        spokenText: 'Hello',
        telemetrySource: 'turn',
        preInitTriggerDuring: 'tts_playback',
        playbackRateMultiplier: 1,
      }),
    ).resolves.toBe('played');
    expect(playElevenLabsMp3WithWebHtmlAudio).toHaveBeenCalled();
  });
});
