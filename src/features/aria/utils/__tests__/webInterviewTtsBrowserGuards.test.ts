import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  isAnyMobileWebBrowser,
  isIosWebkitMobileWebLike,
  shouldDiscourageElevenLabsPcmStreamOnWeb,
  webEmbeddedInAppBrowserDiscouragesPcmStream,
} from '@features/aria/utils/webInterviewTtsBrowserGuards';

describe('webInterviewTtsBrowserGuards', () => {
  it('detects embedded in-app browsers that discourage PCM streaming', () => {
    expect(webEmbeddedInAppBrowserDiscouragesPcmStream('Mozilla FBAN/FB4A')).toBe(true);
    expect(webEmbeddedInAppBrowserDiscouragesPcmStream('Instagram 123')).toBe(true);
    expect(webEmbeddedInAppBrowserDiscouragesPcmStream('Chrome/120')).toBe(false);
  });

  it('detects iOS WebKit mobile browsers', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(isIosWebkitMobileWebLike(ua)).toBe(true);
    expect(isIosWebkitMobileWebLike('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe(false);
  });

  it('detects any mobile web browser', () => {
    expect(isAnyMobileWebBrowser('Mozilla/5.0 (Linux; Android 14)')).toBe(true);
    expect(isAnyMobileWebBrowser('Mozilla/5.0 (Windows NT 10.0)')).toBe(false);
  });

  it('aggregates PCM stream discouragement guards', () => {
    expect(
      shouldDiscourageElevenLabsPcmStreamOnWeb('Mozilla/5.0 (Linux; Android 14)'),
    ).toBe(true);
    expect(
      shouldDiscourageElevenLabsPcmStreamOnWeb('Mozilla/5.0 (Windows NT 10.0)', {
        isIosSafariMobileWeb: () => false,
      }),
    ).toBe(false);
    expect(
      shouldDiscourageElevenLabsPcmStreamOnWeb('Mozilla/5.0 (Windows NT 10.0)', {
        isIosSafariMobileWeb: () => true,
      }),
    ).toBe(true);
  });
});
