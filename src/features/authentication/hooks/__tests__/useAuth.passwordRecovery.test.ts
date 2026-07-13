import { Platform } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';
import {
  AUTH_PASSWORD_RESET_PATH,
  PASSWORD_RESET_PENDING_STORAGE_KEY,
} from '@features/authentication/webAuthRecoveryRouting';
import { getPasswordResetRedirectTo, useAuth } from '../useAuth';

const mockVerifyOtp = jest.fn();
const mockSignOut = jest.fn().mockResolvedValue({});
const mockGetSession = jest.fn().mockResolvedValue({ data: { session: null } });
const mockGetUser = jest.fn().mockResolvedValue({ data: { user: null }, error: null });
const mockResetPasswordForEmail = jest.fn().mockResolvedValue({ error: null });
const mockOnAuthStateChange = jest.fn(
  (_cb: (event: string, session: unknown) => void) => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  }),
);

jest.mock('@data/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) =>
        mockOnAuthStateChange(cb),
      getSession: () => mockGetSession(),
      getUser: () => mockGetUser(),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      signOut: () => mockSignOut(),
      exchangeCodeForSession: jest.fn().mockResolvedValue({ error: null }),
      setSession: jest.fn().mockResolvedValue({}),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      updateUser: jest.fn(),
      resend: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
    },
  },
}));

function mockWebWindow(
  pathname: string,
  search = '',
  hash = '',
  storage: Record<string, string> = {},
) {
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
    sessionStorage: {
      getItem: () => null,
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
    history: { replaceState: jest.fn() },
  } as unknown as Window & typeof globalThis;
}

describe('useAuth password recovery helpers', () => {
  const originalWindow = global.window;
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'web';
    mockWebWindow('/');
    mockVerifyOtp.mockResolvedValue({ error: null });
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignOut.mockClear();
    mockResetPasswordForEmail.mockClear();
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

  it('getPasswordResetRedirectTo points at the auth reset-password path', () => {
    expect(getPasswordResetRedirectTo()).toMatch(new RegExp(`${AUTH_PASSWORD_RESET_PATH}$`));
  });

  it('resetPasswordForEmail marks reset pending and uses the reset redirect URL', async () => {
    const storage: Record<string, string> = {};
    mockWebWindow('/', '', '', storage);

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.resetPasswordForEmail('user@example.com');

    expect(mockSignOut).toHaveBeenCalled();
    expect(storage[PASSWORD_RESET_PENDING_STORAGE_KEY]).toBeDefined();
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@example.com', {
      redirectTo: getPasswordResetRedirectTo(),
    });
  });
});
