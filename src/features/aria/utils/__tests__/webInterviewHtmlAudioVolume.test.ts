import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import { ensureWebHtmlAudioElementMaxVolume } from '@features/aria/utils/webInterviewHtmlAudioVolume';
import {
  applyTabStashedHtmlAudioVolume,
  clearWebInterviewHtmlAudioTabResumeState,
  recordTabHtmlAudioResumeSnapshot,
} from '@features/aria/utils/webInterviewHtmlAudioTabResume';

jest.mock('@features/aria/utils/webInterviewHtmlAudioTabResume', () => {
  const actual = jest.requireActual<typeof import('@features/aria/utils/webInterviewHtmlAudioTabResume')>(
    '@features/aria/utils/webInterviewHtmlAudioTabResume',
  );
  return {
    ...actual,
    shouldSkipWebInterviewTtsVolumeReprime: jest.fn(() => false),
    isWebHtmlAudioMidUtteranceTabResumeElement: jest.fn(() => false),
    applyTabStashedHtmlAudioVolume: jest.fn(),
  };
});

describe('ensureWebHtmlAudioElementMaxVolume', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearWebInterviewHtmlAudioTabResumeState();
  });

  it('sets max volume when re-prime is allowed', () => {
    const el = { volume: 0.2, muted: true } as HTMLAudioElement;
    ensureWebHtmlAudioElementMaxVolume(el);
    expect(el.volume).toBe(1);
    expect(el.muted).toBe(false);
  });

  it('applies stashed volume instead of forcing max during tab resume', () => {
    const { shouldSkipWebInterviewTtsVolumeReprime, isWebHtmlAudioMidUtteranceTabResumeElement } =
      jest.requireMock<typeof import('@features/aria/utils/webInterviewHtmlAudioTabResume')>(
        '@features/aria/utils/webInterviewHtmlAudioTabResume',
      );
    shouldSkipWebInterviewTtsVolumeReprime.mockReturnValue(true);
    isWebHtmlAudioMidUtteranceTabResumeElement.mockReturnValue(true);

    const el = { volume: 0.2, muted: true, ended: false } as HTMLAudioElement;
    recordTabHtmlAudioResumeSnapshot({
      element: el,
      objectUrl: 'blob:test',
      resumeSeconds: 1,
      volume: 0.55,
    });

    ensureWebHtmlAudioElementMaxVolume(el);

    expect(applyTabStashedHtmlAudioVolume).toHaveBeenCalledWith(el);
    expect(el.volume).toBe(0.2);
  });
});
