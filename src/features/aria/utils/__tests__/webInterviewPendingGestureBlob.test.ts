import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  assignPendingWebGestureBlobUrl,
  hasPendingWebGestureBlobUrl,
  resetWebInterviewPendingGestureBlob,
  revokePendingWebGestureBlobUrlUnlessTabStash,
} from '@features/aria/utils/webInterviewPendingGestureBlob';

describe('webInterviewPendingGestureBlob', () => {
  beforeEach(() => {
    resetWebInterviewPendingGestureBlob();
    globalThis.URL.revokeObjectURL = jest.fn();
  });

  it('tracks pending blob URL presence', () => {
    expect(hasPendingWebGestureBlobUrl()).toBe(false);
    assignPendingWebGestureBlobUrl('blob:pending');
    expect(hasPendingWebGestureBlobUrl()).toBe(true);
  });

  it('revokes pending blob unless it matches tab stash', () => {
    assignPendingWebGestureBlobUrl('blob:pending');
    revokePendingWebGestureBlobUrlUnlessTabStash('blob:stash');
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:pending');
    expect(hasPendingWebGestureBlobUrl()).toBe(false);
  });

  it('keeps pending blob when it matches tab stash object URL', () => {
    assignPendingWebGestureBlobUrl('blob:shared');
    revokePendingWebGestureBlobUrlUnlessTabStash('blob:shared');
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(hasPendingWebGestureBlobUrl()).toBe(false);
  });
});
