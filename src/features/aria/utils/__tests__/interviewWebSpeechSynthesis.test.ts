import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/utils/webInterviewMicPreInit', () => ({
  finalizeInterviewMicAmbientOnTtsEnd: jest.fn(),
}));

jest.mock('@features/aria/utils/webInterviewMicPreInitKick', () => ({
  kickInterviewMicPreInitForTtsPlayback: jest.fn(),
}));

jest.mock('@features/aria/utils/webSpeechSynthTabResume', () => ({
  markWebSpeechSynthTabResumeStarted: jest.fn(),
  clearWebSpeechSynthTabResumeState: jest.fn(),
}));

import {
  resetCachedWebSpeechVoice,
  speakWithWebSpeechSynthesis,
  trySpeakWebSpeechInUserGesture,
} from '../interviewWebSpeechSynthesis';

describe('interviewWebSpeechSynthesis', () => {
  beforeEach(() => {
    resetCachedWebSpeechVoice();
    jest.clearAllMocks();
  });

  it('returns no-api when speech synthesis is unavailable', async () => {
    const prevWindow = global.window;
    // @ts-expect-error test shim
    delete global.window;
    await expect(speakWithWebSpeechSynthesis('Hello')).resolves.toEqual({ ok: false, error: 'no-api' });
    global.window = prevWindow;
  });

  it('trySpeakWebSpeechInUserGesture is a no-op without speechSynthesis', () => {
    const prevWindow = global.window;
    // @ts-expect-error test shim
    global.window = {};
    expect(() => trySpeakWebSpeechInUserGesture('Hi', jest.fn())).not.toThrow();
    global.window = prevWindow;
  });
});
