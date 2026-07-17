import { Platform } from 'react-native';

import {
  getAuthEmailRedirectTo,
  getPasswordResetRedirectTo,
  isAuthCallbackDeepLink,
  parseAuthCallbackUrl,
} from '../authDeepLink';

describe('authDeepLink', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('parses amoraea://auth/confirm query callbacks', () => {
    const parts = parseAuthCallbackUrl(
      'amoraea://auth/confirm?token_hash=abc123&type=signup',
    );
    expect(parts.pathname).toBe('/auth/confirm');
    expect(parts.search).toContain('token_hash=abc123');
    expect(parts.search).toContain('type=signup');
  });

  it('parses https confirm callbacks', () => {
    const parts = parseAuthCallbackUrl(
      'https://www.amoraea.com/auth/confirm?token_hash=xyz&type=signup',
    );
    expect(parts.pathname).toBe('/auth/confirm');
    expect(parts.search).toContain('token_hash=xyz');
  });

  it('detects auth callback deep links', () => {
    expect(isAuthCallbackDeepLink('amoraea://auth/reset-password?type=recovery&token_hash=x')).toBe(
      true,
    );
    expect(isAuthCallbackDeepLink('amoraea://something-else')).toBe(false);
  });

  it('uses native app deep links for email redirects', () => {
    Platform.OS = 'android';
    expect(getAuthEmailRedirectTo()).toBe('amoraea://auth/confirm');
    expect(getPasswordResetRedirectTo()).toBe('amoraea://auth/reset-password');
  });

  it('uses https site origin on web', () => {
    Platform.OS = 'web';
    expect(getAuthEmailRedirectTo()).toMatch(/\/auth\/confirm$/);
    expect(getPasswordResetRedirectTo()).toMatch(/\/auth\/reset-password$/);
  });
});
