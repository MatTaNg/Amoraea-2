import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  assignActiveWebHtmlAudio,
  assignActiveWebHtmlAudioObjectUrl,
  clearActiveWebHtmlAudio,
  clearActiveWebHtmlAudioObjectUrlIfMatches,
  getActiveWebHtmlAudioElement,
  getActiveWebHtmlAudioObjectUrl,
  getActiveWebHtmlAudioRef,
  getActiveWebHtmlAudioVolumeForTelemetry,
  resetWebInterviewActiveHtmlAudio,
} from '@features/aria/utils/webInterviewActiveHtmlAudio';

describe('webInterviewActiveHtmlAudio', () => {
  beforeEach(() => {
    resetWebInterviewActiveHtmlAudio();
  });

  it('tracks active HTML audio element refs', () => {
    const el = {
      pause: jest.fn(),
      play: jest.fn(),
      currentTime: 0,
      volume: 0.8,
    } as unknown as HTMLAudioElement;

    assignActiveWebHtmlAudio(el);

    expect(getActiveWebHtmlAudioRef()).toBe(el);
    expect(getActiveWebHtmlAudioElement()).toBe(el);
    expect(getActiveWebHtmlAudioVolumeForTelemetry()).toBe(0.8);
  });

  it('clears object URLs only when they match', () => {
    assignActiveWebHtmlAudioObjectUrl('blob:one');
    clearActiveWebHtmlAudioObjectUrlIfMatches('blob:two');
    expect(getActiveWebHtmlAudioObjectUrl()).toBe('blob:one');
    clearActiveWebHtmlAudioObjectUrlIfMatches('blob:one');
    expect(getActiveWebHtmlAudioObjectUrl()).toBeNull();
  });

  it('resets active audio and object URL state', () => {
    assignActiveWebHtmlAudio({ pause: jest.fn(), currentTime: 0 } as HTMLAudioElement);
    assignActiveWebHtmlAudioObjectUrl('blob:reset');
    resetWebInterviewActiveHtmlAudio();
    expect(getActiveWebHtmlAudioRef()).toBeNull();
    expect(getActiveWebHtmlAudioObjectUrl()).toBeNull();
    clearActiveWebHtmlAudio();
    expect(getActiveWebHtmlAudioElement()).toBeNull();
  });
});
