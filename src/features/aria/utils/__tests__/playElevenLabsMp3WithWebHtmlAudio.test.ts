import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('@features/aria/utils/webInterviewMicPreInit', () => ({
  finalizeInterviewMicAmbientOnTtsEnd: jest.fn(),
}));

jest.mock('@features/aria/utils/webInterviewMicPreInitKick', () => ({
  kickInterviewMicPreInitForTtsPlayback: jest.fn(),
}));

jest.mock('../interviewWebSpeechSynthesis', () => ({
  speakWithWebSpeechSynthesis: jest.fn(async () => ({ ok: false, error: 'no-api' })),
}));

import { playElevenLabsMp3WithWebHtmlAudio } from '../playElevenLabsMp3WithWebHtmlAudio';

describe('playElevenLabsMp3WithWebHtmlAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws on non-web platforms', async () => {
    await expect(
      playElevenLabsMp3WithWebHtmlAudio({
        arrayBuffer: new ArrayBuffer(8),
        spokenText: 'Hello',
        telemetrySource: 'turn',
        preInitTriggerDuring: 'tts_playback',
        playbackRateMultiplier: 1,
        preferTabResumableHtmlAudio: true,
      }),
    ).rejects.toThrow('web only');
  });
});
