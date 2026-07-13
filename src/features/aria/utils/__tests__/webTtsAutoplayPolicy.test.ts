import { describe, expect, it } from '@jest/globals';

import { isWebAudioAutoplayBlockedError } from '@features/aria/utils/webTtsAutoplayPolicy';

describe('webTtsAutoplayPolicy', () => {
  it('detects NotAllowedError autoplay blocks', () => {
    expect(isWebAudioAutoplayBlockedError({ name: 'NotAllowedError', message: 'play() failed' })).toBe(
      true,
    );
    expect(isWebAudioAutoplayBlockedError(new Error('play() requires user gesture'))).toBe(true);
    expect(isWebAudioAutoplayBlockedError(new Error('network error'))).toBe(false);
  });
});
