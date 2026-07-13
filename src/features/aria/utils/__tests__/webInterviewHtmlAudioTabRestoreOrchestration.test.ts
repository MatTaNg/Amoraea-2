import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/utils/webInterviewMicPreInit', () => ({
  finalizeInterviewMicAmbientOnTtsEnd: jest.fn(),
}));

jest.mock('@features/aria/telemetry/tsAutoplayTelemetry', () => ({
  logTtsAutoplayPlayOutcome: jest.fn(),
}));

jest.mock('@features/aria/utils/webInterviewWebAudioPlaybackSurface', () => ({
  hasActiveWebBufferOrPcmPlayback: jest.fn(() => false),
}));

const mockGetActiveElement = jest.fn<() => HTMLAudioElement | null>(() => null);
const mockClearActive = jest.fn();
const mockAssignActive = jest.fn();

jest.mock('@features/aria/utils/webInterviewActiveHtmlAudio', () => ({
  getActiveWebHtmlAudioElement: () => mockGetActiveElement(),
  getActiveWebHtmlAudioObjectUrl: jest.fn(() => 'blob:active'),
  assignActiveWebHtmlAudio: (...args: unknown[]) => mockAssignActive(...args),
  assignActiveWebHtmlAudioObjectUrl: jest.fn(),
  clearActiveWebHtmlAudio: () => mockClearActive(),
  clearActiveWebHtmlAudioObjectUrlIfMatches: jest.fn(),
}));

jest.mock('@features/aria/utils/webInterviewHtmlAudioPlaybackHooks', () => ({
  assignAbortActiveWebHtmlAudioPlayback: jest.fn(),
  claimWebHtmlAudioPlaybackHandoffForTabResume: jest.fn(() => null),
}));

jest.mock('@features/aria/utils/webInterviewSharedHtmlAudio', () => ({
  bindWebInterviewSharedHtmlAudioActiveElement: jest.fn(),
}));

import { hasActiveWebBufferOrPcmPlayback } from '@features/aria/utils/webInterviewWebAudioPlaybackSurface';
import {
  clearWebInterviewHtmlAudioTabResumeState,
  recordTabHtmlAudioResumeSnapshot,
} from '@features/aria/utils/webInterviewHtmlAudioTabResume';
import {
  canSoftPauseActiveWebHtmlAudioForTabResume,
  clearWebInterviewHtmlTabRestoreState,
  softPauseActiveWebHtmlAudioForTabHide,
  tryPrepareWebInterviewHtmlAudioTabResume,
} from '@features/aria/utils/webInterviewHtmlAudioTabRestoreOrchestration';

describe('webInterviewHtmlAudioTabRestoreOrchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearWebInterviewHtmlAudioTabResumeState();
    mockGetActiveElement.mockReturnValue(null);
    (hasActiveWebBufferOrPcmPlayback as jest.Mock).mockReturnValue(false);
  });

  it('canSoftPauseActiveWebHtmlAudioForTabResume is false without active element', () => {
    expect(canSoftPauseActiveWebHtmlAudioForTabResume()).toBe(false);
  });

  it('canSoftPauseActiveWebHtmlAudioForTabResume is true for mid-utterance HTML audio', () => {
    mockGetActiveElement.mockReturnValue({
      ended: false,
      src: 'blob:test',
      currentTime: 2,
      duration: 10,
    } as HTMLAudioElement);
    expect(canSoftPauseActiveWebHtmlAudioForTabResume()).toBe(true);
  });

  it('canSoftPauseActiveWebHtmlAudioForTabResume is false near end of clip', () => {
    mockGetActiveElement.mockReturnValue({
      ended: false,
      src: 'blob:test',
      currentTime: 9.8,
      duration: 10,
    } as HTMLAudioElement);
    expect(canSoftPauseActiveWebHtmlAudioForTabResume()).toBe(false);
  });

  it('tryPrepareWebInterviewHtmlAudioTabResume is true when snapshot pending', () => {
    recordTabHtmlAudioResumeSnapshot({
      element: { ended: false } as HTMLAudioElement,
      objectUrl: 'blob:test',
      resumeSeconds: 1,
      volume: 1,
    });
    expect(tryPrepareWebInterviewHtmlAudioTabResume()).toBe(true);
  });

  it('softPauseActiveWebHtmlAudioForTabHide captures snapshot and clears active ref', () => {
    const el = {
      ended: false,
      src: 'blob:test',
      currentTime: 3,
      duration: 12,
      volume: 0.7,
      pause: jest.fn(),
    } as unknown as HTMLAudioElement;
    mockGetActiveElement.mockReturnValue(el);

    softPauseActiveWebHtmlAudioForTabHide();

    expect(el.pause).toHaveBeenCalled();
    expect(mockClearActive).toHaveBeenCalled();
    expect(tryPrepareWebInterviewHtmlAudioTabResume()).toBe(true);
  });

  it('clearWebInterviewHtmlTabRestoreState clears pending resume', () => {
    const el = {
      ended: false,
      pause: jest.fn(),
    } as unknown as HTMLAudioElement;
    recordTabHtmlAudioResumeSnapshot({
      element: el,
      objectUrl: 'blob:test',
      resumeSeconds: 2,
      volume: 1,
    });

    clearWebInterviewHtmlTabRestoreState();

    expect(el.pause).toHaveBeenCalled();
    expect(tryPrepareWebInterviewHtmlAudioTabResume()).toBe(false);
  });
});
