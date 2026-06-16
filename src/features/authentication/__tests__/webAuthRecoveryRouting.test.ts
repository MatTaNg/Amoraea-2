import { Platform } from 'react-native';
import {
  hasEmailConfirmationAuthHash,
  hasEmailConfirmationAuthQuery,
  hasRecoveryAuthHash,
  hasWebAuthCallbackQuery,
  isEmailConfirmationCallback,
  isEmailConfirmationLandingPath,
  isWebPasswordRecoveryCallback,
  shouldForceWebPasswordResetUi,
} from '@features/authentication/webAuthRecoveryRouting';

describe('webAuthRecoveryRouting', () => {
  const originalWindow = global.window;
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'web';
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
    if (originalWindow) {
      global.window = originalWindow;
    } else {
      // @ts-expect-error test cleanup
      delete global.window;
    }
  });

  function mockLocation(pathname: string, search = '', hash = '', storage: Record<string, string> = {}) {
    global.window = {
      location: { pathname, search, hash },
      localStorage: {
        getItem: (key: string) => storage[key] ?? null,
        setItem: (key: string, value: string) => {
          storage[key] = value;
        },
        removeItem: (key: string) => {
          delete storage[key];
        },
      },
    } as unknown as Window & typeof globalThis;
  }

  it('treats signup confirmation hash as not recovery', () => {
    const hash = '#access_token=abc&refresh_token=def&type=signup';
    expect(hasEmailConfirmationAuthHash(hash)).toBe(true);
    expect(hasRecoveryAuthHash(hash)).toBe(false);
  });

  it('treats recovery hash as recovery', () => {
    const hash = '#access_token=abc&type=recovery';
    expect(hasRecoveryAuthHash(hash)).toBe(true);
    mockLocation('/', '', hash);
    expect(isWebPasswordRecoveryCallback()).toBe(true);
  });

  it('does not treat PKCE code on reset-password as recovery from URL alone', () => {
    mockLocation('/reset-password', '?code=pkce-code');
    expect(isWebPasswordRecoveryCallback()).toBe(false);
    expect(shouldForceWebPasswordResetUi()).toBe(false);
  });

  it('treats PKCE code on confirm-email as email confirmation', () => {
    mockLocation('/confirm-email', '?code=pkce-code');
    expect(isEmailConfirmationCallback()).toBe(true);
    expect(shouldForceWebPasswordResetUi()).toBe(false);
  });

  it('treats token_hash with type=signup on reset-password as email confirmation', () => {
    mockLocation('/reset-password', '?token_hash=abc&type=signup');
    expect(hasEmailConfirmationAuthQuery('?token_hash=abc&type=signup')).toBe(true);
    expect(isEmailConfirmationCallback()).toBe(true);
    expect(isWebPasswordRecoveryCallback()).toBe(false);
  });

  it('does not force reset UI for signup hash on reset-password path', () => {
    mockLocation('/reset-password', '', '#access_token=abc&type=signup');
    expect(isEmailConfirmationCallback()).toBe(true);
    expect(shouldForceWebPasswordResetUi()).toBe(false);
  });

  it('recognizes email confirmation landing paths', () => {
    expect(isEmailConfirmationLandingPath('/')).toBe(true);
    expect(isEmailConfirmationLandingPath('/welcome')).toBe(true);
    expect(isEmailConfirmationLandingPath('/confirm-email')).toBe(true);
    expect(isEmailConfirmationLandingPath('/reset-password')).toBe(false);
  });

  it('treats otp_expired on confirm-email as confirmation error, not recovery', () => {
    const hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid';
    mockLocation('/confirm-email', '', hash);
    expect(hasRecoveryAuthHash(hash, { pathname: '/confirm-email', search: '' })).toBe(false);
    expect(isWebPasswordRecoveryCallback()).toBe(false);
  });

  it('treats otp_expired on reset-password as recovery when reset was requested', () => {
    const hash = '#error=access_denied&error_code=otp_expired';
    mockLocation('/reset-password', '', hash, {
      amoraea_password_reset_pending: String(Date.now()),
    });
    expect(hasRecoveryAuthHash(hash, { pathname: '/reset-password', search: '' })).toBe(true);
  });

  it('does not treat otp_expired on reset-password as recovery without reset request', () => {
    const hash = '#error=access_denied&error_code=otp_expired';
    mockLocation('/reset-password', '', hash);
    expect(hasRecoveryAuthHash(hash, { pathname: '/reset-password', search: '' })).toBe(false);
    expect(isWebPasswordRecoveryCallback()).toBe(false);
  });

  it('detects auth callback query params', () => {
    expect(hasWebAuthCallbackQuery('?code=abc')).toBe(true);
    expect(hasWebAuthCallbackQuery('?foo=bar')).toBe(false);
  });
});
