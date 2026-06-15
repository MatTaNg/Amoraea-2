import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@data/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import type { Gender } from '@domain/models/Profile';
import {
  clearPasswordResetPendingInStorage,
  hasRecoveryAuthHash,
  hasWebAuthCallbackInUrl,
  hasWebAuthCallbackQuery,
  isWebPasswordRecoveryCallback,
  markPasswordResetPendingInStorage,
  normalizeWebPasswordRecoveryUrl,
  parseWebAuthHashError,
  readInitialWebPasswordRecoveryState,
  webPasswordRecoveryLinkErrorMessage,
} from '@features/authentication/webAuthRecoveryRouting';

if (Platform.OS === 'web') {
  normalizeWebPasswordRecoveryUrl();
}

type AuthSnapshot = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  passwordRecoveryPending: boolean;
  passwordRecoveryLinkError: string | null;
};

const initialRecovery = readInitialWebPasswordRecoveryState();
const passwordRecoveryPendingRef = { current: initialRecovery.pending };

let snapshot: AuthSnapshot = {
  session: null,
  user: null,
  loading: true,
  passwordRecoveryPending: initialRecovery.pending,
  passwordRecoveryLinkError: initialRecovery.linkError,
};

const listeners = new Set<() => void>();

function emitAuthChange() {
  listeners.forEach((listener) => listener());
}

function setSnapshot(partial: Partial<AuthSnapshot>) {
  snapshot = { ...snapshot, ...partial };
  emitAuthChange();
}

function subscribeAuth(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getAuthSnapshot(): AuthSnapshot {
  return snapshot;
}

/** Apply auth state from a session + server-verified user (preferred) or cached user on transient errors. */
const applySessionForApp = async (
  session: Session | null,
  opts?: { allowUnconfirmedForRecovery?: boolean },
) => {
  if (!session?.user) {
    return { session: null as Session | null, user: null as User | null };
  }

  if (!session.user.email) {
    await supabase.auth.signOut();
    return { session: null, user: null };
  }

  const {
    data: { user: verifiedUser },
    error: verifyError,
  } = await supabase.auth.getUser();

  if (verifyError) {
    const msg = (verifyError.message ?? '').toLowerCase();
    const isInvalidSession =
      msg.includes('user not found') ||
      msg.includes('invalid refresh token') ||
      msg.includes('refresh token not found');
    if (isInvalidSession) {
      await supabase.auth.signOut();
      return { session: null, user: null };
    }
    if (session.user.email) {
      return { session, user: session.user };
    }
    await supabase.auth.signOut();
    return { session: null, user: null };
  }

  if (!verifiedUser?.email) {
    await supabase.auth.signOut();
    return { session: null, user: null };
  }

  if (!verifiedUser.email_confirmed_at && !opts?.allowUnconfirmedForRecovery) {
    await supabase.auth.signOut();
    return { session: null, user: null };
  }

  return { session, user: verifiedUser };
};

async function bootstrapWebAuthFromUrl(): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  normalizeWebPasswordRecoveryUrl();

  const hashErr = parseWebAuthHashError(window.location.hash);
  if (hashErr) {
    passwordRecoveryPendingRef.current = true;
    setSnapshot({
      passwordRecoveryPending: true,
      passwordRecoveryLinkError: webPasswordRecoveryLinkErrorMessage(hashErr),
    });
    await supabase.auth.signOut();
    return;
  }

  const hasCallback = hasWebAuthCallbackInUrl();
  if (hasCallback || isWebPasswordRecoveryCallback()) {
    passwordRecoveryPendingRef.current = true;
    setSnapshot({ passwordRecoveryPending: true });
  }

  if (!hasCallback) return;

  const code = new URLSearchParams(window.location.search).get('code');
  if (code) {
    /** PKCE recovery links — clear stale sessions before exchanging the one-time code. */
    await supabase.auth.signOut();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      setSnapshot({
        passwordRecoveryLinkError:
          error.message || 'This reset link is invalid. Request a new reset email below.',
      });
    } else {
      window.history.replaceState(null, '', '/reset-password');
    }
    return;
  }

  /** Implicit hash recovery — do not sign out first or detectSessionInUrl loses the token. */
  if (hasRecoveryAuthHash(window.location.hash)) {
    await supabase.auth.getSession();
  }
}

let authInitPromise: Promise<void> | null = null;

function startAuthInitOnce(): Promise<void> {
  if (authInitPromise) return authInitPromise;

  authInitPromise = (async () => {
    let initialSessionSeen = false;

    const sync = async (nextSession: Session | null) => {
      const next = await applySessionForApp(nextSession, {
        allowUnconfirmedForRecovery: passwordRecoveryPendingRef.current,
      });
      setSnapshot({
        session: next.session,
        user: next.user,
      });
    };

    const finishInitialAuthLoad = () => {
      initialSessionSeen = true;
      setSnapshot({ loading: false });
    };

    await bootstrapWebAuthFromUrl();

    supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        passwordRecoveryPendingRef.current = true;
        setSnapshot({
          passwordRecoveryPending: true,
          passwordRecoveryLinkError: null,
        });
        clearPasswordResetPendingInStorage();
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          normalizeWebPasswordRecoveryUrl();
          const hashError = parseWebAuthHashError(window.location.hash);
          if (!hashError) {
            const search = hasWebAuthCallbackQuery(window.location.search)
              ? window.location.search
              : '';
            window.history.replaceState(null, '', `/reset-password${search}`);
          }
        }
      }
      if (
        event === 'INITIAL_SESSION' ||
        event === 'PASSWORD_RECOVERY' ||
        event === 'SIGNED_IN'
      ) {
        finishInitialAuthLoad();
      }
      void sync(nextSession);
    });

    await supabase.auth.getSession();
    if (!initialSessionSeen) {
      finishInitialAuthLoad();
    }
  })();

  return authInitPromise;
}

/**
 * Site origin for Supabase auth redirects (always root — never `/welcome` or other app paths).
 */
export function getAuthSiteOrigin(): string {
  if (process.env.NODE_ENV === 'development') {
    const dev = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL_DEV?.trim();
    if (dev) {
      try {
        return new URL(dev).origin;
      } catch {
        /* fall through */
      }
    }
    return 'http://localhost:8081';
  }
  const fromEnv = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim();
  if (fromEnv) {
    try {
      return new URL(fromEnv).origin;
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://www.amoraea.com';
}

export function getAuthEmailRedirectTo(): string {
  return `${getAuthSiteOrigin()}/`;
}

export function getPasswordResetRedirectTo(): string {
  return `${getAuthSiteOrigin()}/reset-password`;
}

export const AUTH_EMAIL_RESEND_COOLDOWN_MS = 60_000;

export function isAuthEmailRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  if (code === 'over_email_send_rate_limit') return true;
  const msg = (err as { message?: string }).message?.toLowerCase() ?? '';
  return msg.includes('email rate limit') || msg.includes('only request this after');
}

export function formatAuthEmailRateLimitMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const raw = String((err as { message?: string }).message ?? '');
    const match = raw.match(/after (\d+) seconds?/i);
    if (match) {
      const seconds = Number.parseInt(match[1], 10);
      if (Number.isFinite(seconds) && seconds > 0) {
        return `Too many emails sent. Please wait ${seconds} seconds before trying again.`;
      }
    }
  }
  return 'Too many emails sent. Please wait a few minutes before trying again.';
}

export function getAuthEmailSendErrorMessage(err: unknown, fallback: string): string {
  if (isAuthEmailRateLimitError(err)) {
    return formatAuthEmailRateLimitMessage(err);
  }
  return fallback;
}

export function getAuthUpdatePasswordErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = String((err as { message?: string }).message ?? '').trim();
    if (message.length > 0) return message;
  }
  return 'Could not update your password. Open the latest reset link from your email and try again.';
}

export const useAuth = () => {
  const state = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthSnapshot);

  useEffect(() => {
    void startAuthInitOnce();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signUp = async (
    email: string,
    password: string,
    options?: { inviteCode?: string; age?: number; gender?: Gender },
  ) => {
    const metadata: Record<string, unknown> = {};
    if (options?.inviteCode) metadata.referral_code = options.inviteCode.trim();
    if (typeof options?.age === 'number') metadata.age = options.age;
    if (options?.gender) metadata.gender = options.gender;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: Object.keys(metadata).length ? metadata : undefined,
        emailRedirectTo: getAuthEmailRedirectTo(),
      },
    });
    if (error) throw error;
    if (data.user == null) {
      throw new Error('An account with this email already exists. Sign in instead.');
    }
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists. Sign in instead.');
    }
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resendConfirmationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: getAuthEmailRedirectTo(),
      },
    });
    if (error) throw error;
  };

  const resetPasswordForEmail = async (email: string) => {
    await supabase.auth.signOut();
    markPasswordResetPendingInStorage();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getPasswordResetRedirectTo(),
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    if (!currentSession) {
      throw new Error(
        'Your reset session is missing. Open the latest link from your email in this browser tab, then try again.',
      );
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    passwordRecoveryPendingRef.current = false;
    clearPasswordResetPendingInStorage();
    setSnapshot({
      passwordRecoveryPending: false,
    });
    await supabase.auth.signOut();
  };

  const clearPasswordRecoveryPending = () => {
    passwordRecoveryPendingRef.current = false;
    clearPasswordResetPendingInStorage();
    setSnapshot({
      passwordRecoveryPending: false,
      passwordRecoveryLinkError: null,
    });
  };

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    resendConfirmationEmail,
    resetPasswordForEmail,
    updatePassword,
    clearPasswordRecoveryPending,
  };
};
