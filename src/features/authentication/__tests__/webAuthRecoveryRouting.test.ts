import { Platform } from 'react-native';
import {
  AUTH_EMAIL_CONFIRM_PATH,
  AUTH_PASSWORD_RESET_PATH,
  hasEmailConfirmationAuthHash,
  hasEmailConfirmationAuthQuery,
  hasExplicitWebPasswordRecoveryContext,
  hasRecoveryAuthHash,
  hasWebAuthCallbackQuery,
  isBarePasswordResetLanding,
  isEmailConfirmationCallback,
  isEmailConfirmationLandingPath,
  isSignupConfirmAtLoad,
  isWebPasswordRecoveryCallback,
  readInitialWebPasswordRecoveryState,
  resolveWebAuthCallbackIntent,
  shouldArmPasswordRecoveryUi,
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
    mockLocation(AUTH_PASSWORD_RESET_PATH, '?code=pkce-code');
    expect(isWebPasswordRecoveryCallback()).toBe(false);
    expect(shouldForceWebPasswordResetUi()).toBe(false);
  });

  it('treats misrouted PKCE signup confirm on reset-password as email confirmation', () => {
    mockLocation(AUTH_PASSWORD_RESET_PATH, '?code=pkce-code');
    expect(isEmailConfirmationCallback()).toBe(true);
  });

  it('treats misrouted PKCE on reset-password as confirmation even with stale reset pending', () => {
    mockLocation(
      AUTH_PASSWORD_RESET_PATH,
      '?code=pkce-code',
      '',
      { amoraea_password_reset_pending: String(Date.now()) },
    );
    expect(isEmailConfirmationCallback()).toBe(true);
  });

  it('clears stale reset pending when confirm type is in the URL', () => {
    mockLocation(AUTH_PASSWORD_RESET_PATH, '?token_hash=abc&type=signup');
    expect(isEmailConfirmationCallback()).toBe(true);
  });

  it('resolves signup token type as confirm intent', () => {
    expect(
      resolveWebAuthCallbackIntent(
        AUTH_PASSWORD_RESET_PATH,
        '?token_hash=abc&type=signup',
        '',
      ),
    ).toBe('confirm');
  });

  it('resolves recovery token type as recovery intent', () => {
    expect(
      resolveWebAuthCallbackIntent('/', '?token_hash=abc&type=recovery', ''),
    ).toBe('recovery');
  });

  it('treats explicit recovery query on reset-password as not email confirmation', () => {
    mockLocation(AUTH_PASSWORD_RESET_PATH, '?code=pkce-code&type=recovery');
    expect(isEmailConfirmationCallback()).toBe(false);
  });

  it('treats PKCE code on auth/confirm as email confirmation', () => {
    mockLocation(AUTH_EMAIL_CONFIRM_PATH, '?code=pkce-code');
    expect(isEmailConfirmationCallback()).toBe(true);
    expect(shouldForceWebPasswordResetUi()).toBe(false);
  });

  it('treats token_hash with type=signup on reset-password as email confirmation', () => {
    mockLocation(AUTH_PASSWORD_RESET_PATH, '?token_hash=abc&type=signup');
    expect(hasEmailConfirmationAuthQuery('?token_hash=abc&type=signup')).toBe(true);
    expect(isEmailConfirmationCallback()).toBe(true);
    expect(isWebPasswordRecoveryCallback()).toBe(false);
  });

  it('does not force reset UI for signup hash on reset-password path', () => {
    mockLocation(AUTH_PASSWORD_RESET_PATH, '', '#access_token=abc&type=signup');
    expect(isEmailConfirmationCallback()).toBe(true);
    expect(shouldForceWebPasswordResetUi()).toBe(false);
  });

  it('does not treat stale reset pending on home as explicit recovery', () => {
    mockLocation('/', '', '', { amoraea_password_reset_pending: String(Date.now()) });
    expect(
      hasExplicitWebPasswordRecoveryContext('/', '', '', null),
    ).toBe(false);
  });

  it('treats reset pending on reset-password path as explicit recovery', () => {
    mockLocation(AUTH_PASSWORD_RESET_PATH, '', '', {
      amoraea_password_reset_pending: String(Date.now()),
    });
    expect(
      hasExplicitWebPasswordRecoveryContext(AUTH_PASSWORD_RESET_PATH, '', '', null),
    ).toBe(true);
  });

  it('does not treat bare home path as email confirmation callback', () => {
    mockLocation('/');
    expect(isEmailConfirmationCallback()).toBe(false);
  });

  it('treats post-confirm landing query as email confirmation context', () => {
    mockLocation('/', '?confirmEmail=1');
    expect(isEmailConfirmationCallback()).toBe(true);
  });

  it('redirects bare reset-password landing without auth params', () => {
    mockLocation(AUTH_PASSWORD_RESET_PATH);
    expect(isBarePasswordResetLanding(AUTH_PASSWORD_RESET_PATH, '', '')).toBe(true);
    expect(isEmailConfirmationCallback()).toBe(false);
    expect(shouldForceWebPasswordResetUi()).toBe(false);
  });

  it('recognizes email confirmation landing paths', () => {
    expect(isEmailConfirmationLandingPath('/')).toBe(true);
    expect(isEmailConfirmationLandingPath('/welcome')).toBe(true);
    expect(isEmailConfirmationLandingPath(AUTH_EMAIL_CONFIRM_PATH)).toBe(true);
    expect(isEmailConfirmationLandingPath('/confirm-email')).toBe(true);
    expect(isEmailConfirmationLandingPath(AUTH_PASSWORD_RESET_PATH)).toBe(false);
  });

  it('treats otp_expired on auth/confirm as confirmation error, not recovery', () => {
    const hash = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid';
    mockLocation(AUTH_EMAIL_CONFIRM_PATH, '', hash);
    expect(hasRecoveryAuthHash(hash, { pathname: AUTH_EMAIL_CONFIRM_PATH, search: '' })).toBe(false);
    expect(isWebPasswordRecoveryCallback()).toBe(false);
  });

  it('treats otp_expired on reset-password as recovery when reset was requested', () => {
    const hash = '#error=access_denied&error_code=otp_expired';
    mockLocation(AUTH_PASSWORD_RESET_PATH, '?type=recovery', hash, {
      amoraea_password_reset_pending: String(Date.now()),
    });
    expect(hasRecoveryAuthHash(hash, { pathname: AUTH_PASSWORD_RESET_PATH, search: '?type=recovery' })).toBe(true);
  });

  it('does not treat otp_expired on reset-password as recovery without reset request', () => {
    const hash = '#error=access_denied&error_code=otp_expired';
    mockLocation(AUTH_PASSWORD_RESET_PATH, '', hash);
    expect(hasRecoveryAuthHash(hash, { pathname: AUTH_PASSWORD_RESET_PATH, search: '' })).toBe(false);
    expect(isWebPasswordRecoveryCallback()).toBe(false);
  });

  it('detects signup confirm snapshot at module load on auth/confirm', () => {
    expect(
      isSignupConfirmAtLoad(
        'confirm',
        'signup',
        AUTH_EMAIL_CONFIRM_PATH,
      ),
    ).toBe(true);
    expect(
      isSignupConfirmAtLoad(null, null, AUTH_EMAIL_CONFIRM_PATH),
    ).toBe(true);
    expect(
      isSignupConfirmAtLoad(null, null, '/'),
    ).toBe(false);
  });

  it('detects auth callback query params', () => {
    expect(hasWebAuthCallbackQuery('?code=abc')).toBe(true);
    expect(hasWebAuthCallbackQuery('?foo=bar')).toBe(false);
  });

  it('shouldArmPasswordRecoveryUi arms only for recovery intent', () => {
    expect(shouldArmPasswordRecoveryUi('recovery', '/', '', '')).toBe(true);
    expect(shouldArmPasswordRecoveryUi('confirm', '/', '', '')).toBe(false);
    expect(shouldArmPasswordRecoveryUi(null, '/', '', '')).toBe(false);
  });

  it('shouldArmPasswordRecoveryUi rejects confirm token type even when intent is recovery', () => {
    mockLocation(AUTH_PASSWORD_RESET_PATH, '?token_hash=abc&type=signup');
    expect(shouldArmPasswordRecoveryUi('recovery')).toBe(false);
  });

  it('readInitialWebPasswordRecoveryState surfaces recovery link errors without arming UI', () => {
    const hash = '#error=access_denied&error_code=otp_expired';
    mockLocation(AUTH_PASSWORD_RESET_PATH, '?type=recovery', hash);
    const state = readInitialWebPasswordRecoveryState();
    expect(state.pending).toBe(false);
    expect(state.linkError).toMatch(/expired/i);
    expect(state.emailConfirmationLinkError).toBeNull();
  });

  it('readInitialWebPasswordRecoveryState surfaces email confirmation errors on confirm paths', () => {
    const hash = '#error=access_denied&error_code=otp_expired';
    mockLocation(AUTH_EMAIL_CONFIRM_PATH, '', hash);
    const state = readInitialWebPasswordRecoveryState();
    expect(state.pending).toBe(false);
    expect(state.emailConfirmationLinkError).toMatch(/expired|confirmation/i);
    expect(state.linkError).toBeNull();
  });
});
