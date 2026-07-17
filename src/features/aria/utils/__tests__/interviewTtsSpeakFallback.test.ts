import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn((_text: string, opts?: { onDone?: () => void }) => {
    opts?.onDone?.();
  }),
  stop: jest.fn(),
}));

jest.mock('../elevenLabsTtsPlaybackStop', () => ({
  stopElevenLabsPlayback: jest.fn(async () => undefined),
}));

jest.mock('../audioModeHelpers', () => ({
  logAndApplyPlaybackModeForTts: jest.fn(async () => undefined),
}));

jest.mock('../interviewTtsPlaybackRate', () => ({
  getLocalDevPlaybackRateMultiplier: jest.fn(() => 1),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: {} },
  },
}));

import * as Speech from 'expo-speech';
import { speakFallback } from '../interviewTtsSpeakFallback';
import { stopElevenLabsPlayback } from '../elevenLabsTtsPlaybackStop';

describe('speakFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses expo-speech on native', async () => {
    await speakFallback('Hello there');
    expect(stopElevenLabsPlayback).toHaveBeenCalled();
    expect(Speech.speak).toHaveBeenCalledWith(
      'Hello there',
      expect.objectContaining({ language: 'en-US' }),
    );
  });

  it('does not pass hyphenated Amoraea pronunciation to expo-speech', async () => {
    await speakFallback("Hi, I'm Amoraea. What can I call you?");
    expect(Speech.speak).toHaveBeenCalledWith(
      "Hi, I'm Ah mor AY ah. What can I call you?",
      expect.objectContaining({ language: 'en-US' }),
    );
  });
});
