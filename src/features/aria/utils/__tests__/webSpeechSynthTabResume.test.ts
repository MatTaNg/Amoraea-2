import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  captureWebSpeechSynthTabRestoreText,
  clearWebSpeechSynthTabResumeState,
  markWebSpeechSynthTabResumeStarted,
} from '@features/aria/utils/webSpeechSynthTabResume';

describe('webSpeechSynthTabResume', () => {
  beforeEach(() => {
    clearWebSpeechSynthTabResumeState();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null when no utterance has started', () => {
    expect(captureWebSpeechSynthTabRestoreText()).toBeNull();
  });

  it('estimates remaining text while speech synthesis is still speaking', () => {
    const fullText = 'This is a longer assistant line for tab-hide resume testing.';
    markWebSpeechSynthTabResumeStarted(fullText);
    (global as unknown as { window: Window }).window = {
      speechSynthesis: { speaking: true },
    } as Window;

    jest.advanceTimersByTime(2000);

    const remaining = captureWebSpeechSynthTabRestoreText();
    expect(remaining).toBeTruthy();
    expect(fullText.endsWith(remaining!)).toBe(true);
    expect(remaining!.length).toBeLessThan(fullText.length);
  });

  it('returns null for stale non-speaking utterances after the grace window', () => {
    markWebSpeechSynthTabResumeStarted('Short stale line that should not resume.');
    (global as unknown as { window: Window }).window = {
      speechSynthesis: { speaking: false },
    } as Window;

    jest.advanceTimersByTime(5000);

    expect(captureWebSpeechSynthTabRestoreText()).toBeNull();
  });

  it('clears tracked state', () => {
    markWebSpeechSynthTabResumeStarted('Tracked line for reset coverage.');
    clearWebSpeechSynthTabResumeState();
    expect(captureWebSpeechSynthTabRestoreText()).toBeNull();
  });
});
