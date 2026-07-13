import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('../audioModeHelpers', () => ({
  logAndApplyPlaybackModeForTts: jest.fn(async () => undefined),
}));

jest.mock('../elevenLabsTtsAvailability', () => ({
  isElevenLabsEnabledForEnvironment: jest.fn(() => false),
  iosUseElevenLabsMp3Playback: jest.fn(() => false),
}));

jest.mock('../elevenLabsTtsPlaybackStop', () => ({
  stopElevenLabsPlayback: jest.fn(async () => undefined),
}));

jest.mock('../elevenLabsTtsCredentials', () => ({
  getElevenLabsApiKey: jest.fn(() => ''),
  getTtsProxyUrl: jest.fn(() => ''),
}));

jest.mock('../elevenLabsTtsFetch', () => ({
  fetchElevenLabsMpegArrayBuffer: jest.fn(async () => null),
}));

jest.mock('../elevenLabsTtsVoice', () => ({
  applyAmoraeaPronunciation: (text: string) => text,
}));

jest.mock('../elevenLabsSpokenContext', () => ({
  recordElevenLabsSpokenContext: jest.fn(),
}));

jest.mock('../speakElevenLabsWebMp3', () => ({
  speakElevenLabsWebMp3: jest.fn(async () => 'played'),
}));

jest.mock('../interviewTtsSpeakFallback', () => ({
  speakFallback: jest.fn(async () => undefined),
}));

import { speakWithElevenLabs } from '../speakWithElevenLabsCore';
import { speakFallback } from '../interviewTtsSpeakFallback';

describe('speakWithElevenLabsCore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses speakFallback when ElevenLabs is disabled for environment', async () => {
    await speakWithElevenLabs('Hello');
    expect(speakFallback).toHaveBeenCalledWith('Hello', undefined, undefined);
  });
});
