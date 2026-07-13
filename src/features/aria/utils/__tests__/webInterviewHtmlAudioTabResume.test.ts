import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  applyTabStashedHtmlAudioVolume,
  clearWebInterviewHtmlAudioTabResumeState,
  getTabHtmlAudioResumeSnapshot,
  hasWebInterviewHtmlAudioTabResumePending,
  isWebInterviewMidUtteranceTabResumeActive,
  markTabRestoreSyncPlayStarted,
  recordTabHtmlAudioResumeSnapshot,
  shouldSkipTabRestoreSyncPlay,
} from '@features/aria/utils/webInterviewHtmlAudioTabResume';
import {
  releaseWebInterviewTabRestoreStash,
  setWebInterviewTabRestoreStash,
} from '@features/aria/utils/webInterviewTabRestoreStash';

describe('webInterviewHtmlAudioTabResume', () => {
  beforeEach(() => {
    clearWebInterviewHtmlAudioTabResumeState();
    releaseWebInterviewTabRestoreStash(false);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports pending resume when a snapshot exists', () => {
    const element = { ended: false, volume: 0.8, muted: false } as HTMLAudioElement;
    recordTabHtmlAudioResumeSnapshot({
      element,
      objectUrl: 'blob:test',
      resumeSeconds: 1.5,
      volume: 0.8,
    });

    expect(hasWebInterviewHtmlAudioTabResumePending()).toBe(true);
    expect(getTabHtmlAudioResumeSnapshot()?.resumeSeconds).toBe(1.5);
    expect(isWebInterviewMidUtteranceTabResumeActive()).toBe(true);
  });

  it('also reports pending resume when only the blob stash exists', () => {
    setWebInterviewTabRestoreStash({ objectUrl: 'blob:stash-only', resumeSeconds: 0.4 });
    expect(hasWebInterviewHtmlAudioTabResumePending()).toBe(true);
  });

  it('restores stashed volume without forcing max volume', () => {
    const element = {
      ended: false,
      volume: 1,
      muted: true,
    } as HTMLAudioElement;
    recordTabHtmlAudioResumeSnapshot({
      element,
      objectUrl: 'blob:test',
      resumeSeconds: 2,
      volume: 0.6,
    });

    applyTabStashedHtmlAudioVolume(element);

    expect(element.muted).toBe(false);
    expect(element.volume).toBe(0.6);
  });

  it('dedupes rapid tab-restore sync play attempts', () => {
    const playKey = 'blob:test|1.000';
    expect(shouldSkipTabRestoreSyncPlay(playKey)).toBe(false);
    markTabRestoreSyncPlayStarted(playKey);
    expect(shouldSkipTabRestoreSyncPlay(playKey)).toBe(true);
  });
});
