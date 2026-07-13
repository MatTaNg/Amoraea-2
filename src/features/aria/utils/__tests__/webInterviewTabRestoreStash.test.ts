import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  assignWebInterviewTabRestorePlaybackEndHandlers,
  getWebInterviewTabRestoreStash,
  hasWebInterviewTabRestoreStash,
  releaseWebInterviewTabRestoreStash,
  setWebInterviewTabRestoreStash,
  settleWebInterviewTabRestorePlaybackEnd,
  waitForWebInterviewTabRestorePlaybackEnd,
} from '@features/aria/utils/webInterviewTabRestoreStash';
import { TtsTabResumeFallbackError } from '@features/aria/utils/webTtsGestureErrors';

describe('webInterviewTabRestoreStash', () => {
  beforeEach(() => {
    releaseWebInterviewTabRestoreStash(false);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('tracks stash presence on web', () => {
    expect(hasWebInterviewTabRestoreStash()).toBe(false);
    setWebInterviewTabRestoreStash({ objectUrl: 'blob:test', resumeSeconds: 1.2 });
    expect(hasWebInterviewTabRestoreStash()).toBe(true);
    expect(getWebInterviewTabRestoreStash()).toEqual({
      objectUrl: 'blob:test',
      resumeSeconds: 1.2,
    });
  });

  it('revokes object URLs through the release hook', () => {
    const onRevokeObjectUrl = jest.fn();
    setWebInterviewTabRestoreStash({ objectUrl: 'blob:revoke-me', resumeSeconds: 0 });
    releaseWebInterviewTabRestoreStash(true, { onRevokeObjectUrl });
    expect(onRevokeObjectUrl).toHaveBeenCalledWith('blob:revoke-me');
    expect(getWebInterviewTabRestoreStash()).toBeNull();
  });

  it('settles assigned playback-end handlers', async () => {
    const resolve = jest.fn();
    const reject = jest.fn();
    assignWebInterviewTabRestorePlaybackEndHandlers(resolve, reject);

    settleWebInterviewTabRestorePlaybackEnd();
    expect(resolve).toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();

    assignWebInterviewTabRestorePlaybackEndHandlers(resolve, reject);
    settleWebInterviewTabRestorePlaybackEnd(new TtsTabResumeFallbackError());
    expect(reject).toHaveBeenCalledWith(expect.any(TtsTabResumeFallbackError));
  });

  it('waits for playback end or times out', async () => {
    const pending = waitForWebInterviewTabRestorePlaybackEnd(1000);
    settleWebInterviewTabRestorePlaybackEnd();
    await expect(pending).resolves.toBeUndefined();

    const timedOut = waitForWebInterviewTabRestorePlaybackEnd(1000);
    jest.advanceTimersByTime(1001);
    await expect(timedOut).rejects.toBeInstanceOf(TtsTabResumeFallbackError);
  });
});
