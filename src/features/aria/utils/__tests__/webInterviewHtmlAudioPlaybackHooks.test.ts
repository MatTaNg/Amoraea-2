import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  abortInFlightWebInterviewPlaybackForTabHide,
  assignAbortActiveWebBufferAudioPlayback,
  assignAbortActiveWebHtmlAudioPlayback,
  assignActiveWebHtmlAudioPlaybackHandoff,
  claimWebHtmlAudioPlaybackHandoffForTabResume,
  clearAbortActiveWebHtmlAudioPlaybackIfMatches,
  clearActiveWebHtmlAudioPlaybackHandoffIfObjectUrl,
  resetWebInterviewHtmlAudioPlaybackHooks,
  triggerAbortActiveWebHtmlAudioPlayback,
} from '@features/aria/utils/webInterviewHtmlAudioPlaybackHooks';

describe('webInterviewHtmlAudioPlaybackHooks', () => {
  beforeEach(() => {
    resetWebInterviewHtmlAudioPlaybackHooks();
  });

  it('triggers and clears the active HTML abort handler', () => {
    const abort = jest.fn();
    assignAbortActiveWebHtmlAudioPlayback(abort);

    triggerAbortActiveWebHtmlAudioPlayback();

    expect(abort).toHaveBeenCalled();
    clearAbortActiveWebHtmlAudioPlaybackIfMatches(abort);
    triggerAbortActiveWebHtmlAudioPlayback();
    expect(abort).toHaveBeenCalledTimes(1);
  });

  it('claims tab-resume handoff and clears its safety timeout', () => {
    const clearSafetyTimeout = jest.fn();
    assignActiveWebHtmlAudioPlaybackHandoff({
      clearSafetyTimeout,
      completePlayback: jest.fn(),
      objectUrl: 'blob:handoff',
    });

    const claimed = claimWebHtmlAudioPlaybackHandoffForTabResume('blob:handoff');

    expect(claimed?.objectUrl).toBe('blob:handoff');
    expect(clearSafetyTimeout).toHaveBeenCalled();
    clearActiveWebHtmlAudioPlaybackHandoffIfObjectUrl('blob:handoff');
    expect(claimWebHtmlAudioPlaybackHandoffForTabResume('blob:handoff')).toBeNull();
  });

  it('aborts HTML and buffer playback on tab hide', () => {
    const htmlAbort = jest.fn();
    const bufferAbort = jest.fn();
    assignAbortActiveWebHtmlAudioPlayback(htmlAbort);
    assignAbortActiveWebBufferAudioPlayback(bufferAbort);

    abortInFlightWebInterviewPlaybackForTabHide();

    expect(htmlAbort).toHaveBeenCalled();
    expect(bufferAbort).toHaveBeenCalled();
  });
});
