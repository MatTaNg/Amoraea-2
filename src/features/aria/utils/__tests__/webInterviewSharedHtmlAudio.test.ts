import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/utils/webSpeechDeferPolicy', () => ({
  webSpeechShouldDeferToUserGesture: jest.fn(() => true),
}));

import {
  bindWebInterviewSharedHtmlAudioActiveElement,
  ensureSharedHtmlAudioElementForInterviewTts,
  getSharedHtmlAudioForMobileTts,
  hasSharedHtmlAudioForInterviewTts,
  primeHtmlAudioForMobileTtsFromMicGesture,
  reprimeSharedHtmlAudioSilentPlay,
  resetWebInterviewSharedHtmlAudio,
} from '@features/aria/utils/webInterviewSharedHtmlAudio';

describe('webInterviewSharedHtmlAudio', () => {
  beforeEach(() => {
    resetWebInterviewSharedHtmlAudio();
    bindWebInterviewSharedHtmlAudioActiveElement(() => null);
    jest.clearAllMocks();
  });

  it('creates and reuses a shared HTML audio element', () => {
    const AudioCtor = jest.fn(() => ({
      setAttribute: jest.fn(),
      playsInline: false,
      preload: 'auto',
      volume: 1,
      muted: false,
      currentTime: 0,
      src: '',
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn(),
    }));
    (globalThis as { Audio?: unknown }).Audio = AudioCtor as unknown as typeof Audio;

    const first = ensureSharedHtmlAudioElementForInterviewTts();
    const second = ensureSharedHtmlAudioElementForInterviewTts();
    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(hasSharedHtmlAudioForInterviewTts()).toBe(true);
    expect(getSharedHtmlAudioForMobileTts()).toBe(first);
  });

  it('primes shared audio from mic gesture when gesture deferral applies', () => {
    const play = jest.fn().mockResolvedValue(undefined);
    const pause = jest.fn();
    const AudioCtor = jest.fn(() => ({
      setAttribute: jest.fn(),
      playsInline: false,
      preload: 'auto',
      volume: 1,
      muted: false,
      currentTime: 0,
      src: '',
      play,
      pause,
    }));
    (globalThis as { Audio?: unknown }).Audio = AudioCtor as unknown as typeof Audio;

    primeHtmlAudioForMobileTtsFromMicGesture();

    const el = getSharedHtmlAudioForMobileTts();
    expect(el).toBeTruthy();
    expect(play).toHaveBeenCalled();
    expect(el?.src).toContain('data:audio/wav');
    expect(el?.muted).toBe(true);
  });

  it('skips reprime when the shared element is actively playing TTS', () => {
    const play = jest.fn().mockResolvedValue(undefined);
    const shared = {
      paused: false,
      src: '',
      muted: false,
      volume: 1,
      currentTime: 0,
      play,
      pause: jest.fn(),
      setAttribute: jest.fn(),
      playsInline: false,
      preload: 'auto',
    } as unknown as HTMLAudioElement;
    (globalThis as { Audio?: unknown }).Audio = jest.fn(() => shared) as unknown as typeof Audio;
    ensureSharedHtmlAudioElementForInterviewTts();
    bindWebInterviewSharedHtmlAudioActiveElement(() => shared);

    reprimeSharedHtmlAudioSilentPlay();

    expect(play).not.toHaveBeenCalled();
  });

  it('reprimes silently when shared audio is idle', async () => {
    const play = jest.fn().mockResolvedValue(undefined);
    const pause = jest.fn();
    const shared = {
      paused: true,
      src: '',
      muted: false,
      volume: 1,
      currentTime: 0,
      play,
      pause,
      setAttribute: jest.fn(),
      playsInline: false,
      preload: 'auto',
    } as unknown as HTMLAudioElement;
    (globalThis as { Audio?: unknown }).Audio = jest.fn(() => shared) as unknown as typeof Audio;
    ensureSharedHtmlAudioElementForInterviewTts();

    reprimeSharedHtmlAudioSilentPlay();

    expect(play).toHaveBeenCalled();
    await Promise.resolve();
    expect(pause).toHaveBeenCalled();
  });
});
