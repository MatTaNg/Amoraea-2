import { Platform } from 'react-native';
import {
  normalizeSignupLeadToken,
  readSignupLeadFromWebUrl,
} from '../signupLead';

describe('signupLead', () => {
  it('normalizes signup lead tokens', () => {
    expect(normalizeSignupLeadToken('  abc-123  ')).toBe('abc-123');
    expect(normalizeSignupLeadToken('')).toBeNull();
    expect(normalizeSignupLeadToken(undefined)).toBeNull();
  });

  it('reads lead query param on web', () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      get: () => 'web',
    });
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, search: '?lead=test-token-xyz' },
    });
    expect(readSignupLeadFromWebUrl()).toBe('test-token-xyz');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: original,
    });
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      get: () => originalPlatform,
    });
  });
});
