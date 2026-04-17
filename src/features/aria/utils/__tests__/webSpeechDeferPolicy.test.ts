import { getWebSpeechDeferFromNavigatorSnapshot } from '../webSpeechDeferPolicy';

describe('getWebSpeechDeferFromNavigatorSnapshot', () => {
  it('defers for iPhone UA', () => {
    expect(
      getWebSpeechDeferFromNavigatorSnapshot({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        platform: 'iPhone',
        maxTouchPoints: 5,
      })
    ).toBe(true);
  });

  it('defers for iPad UA', () => {
    expect(
      getWebSpeechDeferFromNavigatorSnapshot({
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      })
    ).toBe(true);
  });

  it('defers for Android UA', () => {
    expect(
      getWebSpeechDeferFromNavigatorSnapshot({
        userAgent: 'Mozilla/5.0 (Linux; Android 14)',
        platform: 'Linux armv8l',
        maxTouchPoints: 5,
      })
    ).toBe(true);
  });

  it('defers for MacIntel with multiple touch points (iPad desktop mode heuristic)', () => {
    expect(
      getWebSpeechDeferFromNavigatorSnapshot({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
        platform: 'MacIntel',
        maxTouchPoints: 2,
      })
    ).toBe(true);
  });

  it('does not defer for typical Windows desktop Chrome', () => {
    expect(
      getWebSpeechDeferFromNavigatorSnapshot({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        platform: 'Win32',
        maxTouchPoints: 0,
      })
    ).toBe(false);
  });

  it('does not defer for MacIntel with single touch point (mouse / trackpad)', () => {
    expect(
      getWebSpeechDeferFromNavigatorSnapshot({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)',
        platform: 'MacIntel',
        maxTouchPoints: 1,
      })
    ).toBe(false);
  });
});
