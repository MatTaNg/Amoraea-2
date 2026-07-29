import {
  getInterviewTtsSessionEmail,
  isDefaultVoiceFastPlaybackAccountEmail,
  isLocalWebDevHost,
  normalizeInterviewTtsAccountEmail,
  setInterviewTtsSessionEmail,
  shouldUseDefaultVoiceInsteadOfElevenLabs,
} from '../interviewTtsDevAccount';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

describe('interviewTtsDevAccount', () => {
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

  it('normalizes email for comparison', () => {
    expect(normalizeInterviewTtsAccountEmail('  MattAng5280@Gmail.com ')).toBe('mattang5280@gmail.com');
  });

  it('recognizes configured dev accounts', () => {
    expect(isDefaultVoiceFastPlaybackAccountEmail('mattang5280@gmail.com')).toBe(true);
    expect(isDefaultVoiceFastPlaybackAccountEmail('ng5280@hotmail.com')).toBe(true);
    expect(isDefaultVoiceFastPlaybackAccountEmail('other@example.com')).toBe(false);
    expect(isDefaultVoiceFastPlaybackAccountEmail(null)).toBe(false);
  });

  it('detects loopback web hosts only', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'localhost' },
    });
    expect(isLocalWebDevHost()).toBe(true);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'app.amoraea.com' },
    });
    expect(isLocalWebDevHost()).toBe(false);
  });

  it('skips ElevenLabs for configured accounts on production builds', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'app.amoraea.com' },
    });
    (global as { __DEV__?: boolean }).__DEV__ = false;
    setInterviewTtsSessionEmail('mattang5280@gmail.com');
    expect(shouldUseDefaultVoiceInsteadOfElevenLabs()).toBe(true);
  });

  it('skips ElevenLabs for configured accounts on localhost in a dev bundle', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'localhost' },
    });
    (global as { __DEV__?: boolean }).__DEV__ = true;
    setInterviewTtsSessionEmail('ng5280@hotmail.com');
    expect(getInterviewTtsSessionEmail()).toBe('ng5280@hotmail.com');
    expect(shouldUseDefaultVoiceInsteadOfElevenLabs()).toBe(true);
    setInterviewTtsSessionEmail(null);
    expect(shouldUseDefaultVoiceInsteadOfElevenLabs()).toBe(false);
  });

  it('does not skip ElevenLabs for other accounts on production host', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'app.amoraea.com' },
    });
    (global as { __DEV__?: boolean }).__DEV__ = true;
    setInterviewTtsSessionEmail('mattang5280@gmail.com');
    expect(shouldUseDefaultVoiceInsteadOfElevenLabs()).toBe(true);
    setInterviewTtsSessionEmail('other@example.com');
    expect(shouldUseDefaultVoiceInsteadOfElevenLabs()).toBe(false);
  });

  it('skips ElevenLabs on native builds for configured accounts', () => {
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
    const nativeModule = require('../interviewTtsDevAccount') as typeof import('../interviewTtsDevAccount');
    (global as { __DEV__?: boolean }).__DEV__ = true;
    nativeModule.setInterviewTtsSessionEmail('mattang5280@gmail.com');
    expect(nativeModule.shouldUseDefaultVoiceInsteadOfElevenLabs()).toBe(true);
  });
});
