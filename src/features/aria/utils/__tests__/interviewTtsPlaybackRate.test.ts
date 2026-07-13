import { setInterviewTtsSessionEmail } from '../interviewTtsDevAccount';
import { getLocalDevPlaybackRateMultiplier } from '../interviewTtsPlaybackRate';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

describe('interviewTtsPlaybackRate', () => {
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;
  const originalLocation = window.location;

  afterEach(() => {
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
    setInterviewTtsSessionEmail(null);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('uses 2x playback for configured dev accounts regardless of hostname', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'app.amoraea.com' },
    });
    (global as { __DEV__?: boolean }).__DEV__ = false;
    setInterviewTtsSessionEmail('mattang5280@gmail.com');
    expect(getLocalDevPlaybackRateMultiplier()).toBe(2);
  });

  it('uses 2x playback on localhost in dev when not a dev account', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'localhost' },
    });
    (global as { __DEV__?: boolean }).__DEV__ = true;
    setInterviewTtsSessionEmail('other@example.com');
    expect(getLocalDevPlaybackRateMultiplier()).toBe(2);
  });
});
