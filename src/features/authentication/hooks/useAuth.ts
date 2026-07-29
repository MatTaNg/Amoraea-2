import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@data/supabase/client';
import { Session, User, type EmailOtpType } from '@supabase/supabase-js';
import type { Gender } from '@domain/models/Profile';
import { isRelationshipValidationReferralCode } from '@features/relationshipValidation/constants';
import {
  AUTH_PASSWORD_RESET_PATH,
  clearPasswordResetPendingInStorage,
  hasExplicitRecoveryAuthContext,
  hasImplicitAuthHash,
  hasRecoveryAuthHash,
  hasWebAuthCallbackInUrl,
  hasWebAuthCallbackQuery,
  hasExplicitWebPasswordRecoveryContext,
  isAuthEmailConfirmPath,
  isBarePasswordResetLanding,
  isConfirmEmailTokenType,
  isEmailConfirmationCallback,
  isEmailConfirmationContext,
  isSignupConfirmAtLoad,
  isPasswordResetPendingInStorage,
  markPasswordResetPendingInStorage,
  normalizeWebEmailConfirmationUrl,
  normalizeWebPasswordRecoveryUrl,
  parseWebAuthHashError,
  readAuthCallbackTokenType,
  readInitialWebPasswordRecoveryState,
  resolveWebAuthCallbackIntent,
  webEmailConfirmationLinkErrorMessage,
  webPasswordRecoveryLinkErrorMessage,
  type WebAuthCallbackIntent,
} from '@features/authentication/webAuthRecoveryRouting';
import {
  getAuthEmailRedirectTo,
  getPasswordResetRedirectTo,
  isAuthCallbackDeepLink,
  parseAuthCallbackUrl,
} from '@features/authentication/authDeepLink';
import * as ExpoLinking from 'expo-linking';

export {
  getAuthEmailRedirectTo,
  getPasswordResetRedirectTo,
  getAuthWebSiteOrigin as getAuthSiteOrigin,
} from '@features/authentication/authDeepLink';

if (Platform.OS === 'web') {
  normalizeWebEmailConfirmationUrl();
  normalizeWebPasswordRecoveryUrl();
}

const initialWebAuthCallback =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? (() => {
        const { pathname, search, hash } = window.location;
        return {
          intent: resolveWebAuthCallbackIntent(pathname, search, hash),
          tokenType: readAuthCallbackTokenType(search, hash),
          onConfirmPath: isAuthEmailConfirmPath(pathname),
          signupConfirmAtLoad: isSignupConfirmAtLoad(
            resolveWebAuthCallbackIntent(pathname, search, hash),
            readAuthCallbackTokenType(search, hash),
            pathname,
          ),
        };
      })()
    : {
        intent: null as WebAuthCallbackIntent,
        tokenType: null as string | null,
        onConfirmPath: false,
        signupConfirmAtLoad: false,
      };

const authBootstrapCompleteRef = { current: false };

const webAuthCallbackAtLoadRef = {
  current:
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    hasWebAuthCallbackInUrl(),
};

type AuthSnapshot = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  passwordRecoveryPending: boolean;
  passwordRecoveryLinkError: string | null;
  emailConfirmationLinkError: string | null;
  isRelationshipValidation: boolean;
};

const initialRecovery = readInitialWebPasswordRecoveryState();
const passwordRecoveryPendingRef = { current: initialRecovery.pending };

let snapshot: AuthSnapshot = {
  session: null,
  user: null,
  loading: true,
  passwordRecoveryPending: initialRecovery.pending,
  passwordRecoveryLinkError: initialRecovery.linkError,
  emailConfirmationLinkError: initialRecovery.emailConfirmationLinkError,
  isRelationshipValidation: false,
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

function readIsRelationshipValidation(user: User | null): boolean {
  if (!user) return false;
  const meta = user.user_metadata as {
    is_relationship_validation?: boolean;
    referral_code?: string;
  } | undefined;
  if (meta?.is_relationship_validation === true) return true;
  return isRelationshipValidationReferralCode(meta?.referral_code);
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

async function applySessionFromUrlHash(hash: string): Promise<void> {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return;
  await supabase.auth.setSession({ access_token, refresh_token });
}

async function bootstrapAuthFromLocationParts(parts: {
  pathname: string;
  search: string;
  hash: string;
}): Promise<void> {
  const { pathname, search, hash } = parts;
  const tokenType = readAuthCallbackTokenType(search, hash);

  const replaceHistory = (path: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState(null, '', path);
    }
  };

  if (isBarePasswordResetLanding(pathname, search, hash)) {
    clearPasswordResetPendingInStorage();
    passwordRecoveryPendingRef.current = false;
    setSnapshot({
      passwordRecoveryPending: false,
      passwordRecoveryLinkError: null,
      emailConfirmationLinkError: null,
    });
    replaceHistory('/');
    return;
  }

  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath === '/' && !hasWebAuthCallbackQuery(search) && !hasImplicitAuthHash(hash)) {
    clearPasswordResetPendingInStorage();
  }

  if (isEmailConfirmationContext(pathname, search, hash) || isConfirmEmailTokenType(tokenType)) {
    clearPasswordResetPendingInStorage();
  } else if (
    hasWebAuthCallbackQuery(search) &&
    !hasExplicitRecoveryAuthContext(search, hash)
  ) {
    clearPasswordResetPendingInStorage();
  }

  const hashErr = parseWebAuthHashError(hash);
  if (hashErr) {
    if (isEmailConfirmationContext(pathname, search, hash)) {
      clearPasswordResetPendingInStorage();
      passwordRecoveryPendingRef.current = false;
      setSnapshot({
        passwordRecoveryPending: false,
        passwordRecoveryLinkError: null,
        emailConfirmationLinkError: webEmailConfirmationLinkErrorMessage(hashErr),
      });
      await supabase.auth.signOut();
      replaceHistory('/');
      return;
    }
    if (hasRecoveryAuthHash(hash, { pathname, search })) {
      passwordRecoveryPendingRef.current = true;
      setSnapshot({
        passwordRecoveryPending: true,
        passwordRecoveryLinkError: webPasswordRecoveryLinkErrorMessage(hashErr),
        emailConfirmationLinkError: null,
      });
      await supabase.auth.signOut();
    }
    return;
  }

  if (hasRecoveryAuthHash(hash, { pathname, search })) {
    normalizeWebPasswordRecoveryUrl();
  }

  if (isEmailConfirmationContext(pathname, search, hash)) {
    clearPasswordResetPendingInStorage();
    passwordRecoveryPendingRef.current = false;
    setSnapshot({
      passwordRecoveryPending: false,
      passwordRecoveryLinkError: null,
      emailConfirmationLinkError: null,
    });
  }

  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const code = searchParams.get('code');
  if (code) {
    const explicitRecovery = hasExplicitRecoveryAuthContext(search, hash);
    const recoveryHash = hasRecoveryAuthHash(hash, { pathname, search });
    if (explicitRecovery) {
      passwordRecoveryPendingRef.current = true;
      markPasswordResetPendingInStorage();
    } else if (!recoveryHash) {
      normalizeWebEmailConfirmationUrl();
      await supabase.auth.signOut();
      clearPasswordResetPendingInStorage();
      passwordRecoveryPendingRef.current = false;
      setSnapshot({
        passwordRecoveryPending: false,
        passwordRecoveryLinkError: null,
        emailConfirmationLinkError: null,
      });
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      if (passwordRecoveryPendingRef.current) {
        setSnapshot({
          passwordRecoveryLinkError:
            error.message || 'This reset link is invalid. Request a new reset email below.',
        });
      } else {
        setSnapshot({
          emailConfirmationLinkError:
            error.message ||
            'This confirmation link is invalid or expired. Sign in and request a new confirmation email.',
        });
        replaceHistory('/');
      }
    } else if (passwordRecoveryPendingRef.current) {
      setSnapshot({
        passwordRecoveryPending: true,
        passwordRecoveryLinkError: null,
        emailConfirmationLinkError: null,
      });
      replaceHistory(AUTH_PASSWORD_RESET_PATH);
    }
    return;
  }

  const tokenHash = searchParams.get('token_hash');
  if (tokenHash && tokenType) {
    const isRecovery = tokenType === 'recovery';
    if (isRecovery) {
      passwordRecoveryPendingRef.current = true;
      markPasswordResetPendingInStorage();
    } else {
      await supabase.auth.signOut();
      clearPasswordResetPendingInStorage();
      passwordRecoveryPendingRef.current = false;
    }
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tokenType as EmailOtpType,
    });
    if (error) {
      if (isRecovery) {
        setSnapshot({
          passwordRecoveryLinkError:
            error.message ||
            'This reset link is invalid or expired. Request a new reset email below.',
        });
      } else {
        setSnapshot({
          emailConfirmationLinkError:
            error.message ||
            'This confirmation link is invalid or expired. Sign in and request a new confirmation email.',
        });
        replaceHistory('/');
      }
    } else if (isRecovery) {
      setSnapshot({
        passwordRecoveryPending: true,
        passwordRecoveryLinkError: null,
        emailConfirmationLinkError: null,
      });
      replaceHistory(AUTH_PASSWORD_RESET_PATH);
    } else {
      clearPasswordResetPendingInStorage();
      passwordRecoveryPendingRef.current = false;
      setSnapshot({
        passwordRecoveryPending: false,
        passwordRecoveryLinkError: null,
        emailConfirmationLinkError: null,
      });
      replaceHistory('/?confirmEmail=1');
    }
    return;
  }

  if (hasImplicitAuthHash(hash)) {
    if (isEmailConfirmationContext(pathname, search, hash)) {
      clearPasswordResetPendingInStorage();
      passwordRecoveryPendingRef.current = false;
    } else if (hasRecoveryAuthHash(hash, { pathname, search })) {
      passwordRecoveryPendingRef.current = true;
      markPasswordResetPendingInStorage();
      setSnapshot({
        passwordRecoveryPending: true,
        passwordRecoveryLinkError: null,
        emailConfirmationLinkError: null,
      });
    }
    await applySessionFromUrlHash(hash);
  }
}

async function bootstrapWebAuthFromUrl(): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  await bootstrapAuthFromLocationParts({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  });
}

async function bootstrapNativeAuthFromUrl(url: string | null): Promise<void> {
  if (Platform.OS === 'web' || !url || !isAuthCallbackDeepLink(url)) return;
  webAuthCallbackAtLoadRef.current = true;
  await bootstrapAuthFromLocationParts(parseAuthCallbackUrl(url));
}

let authInitPromise: Promise<void> | null = null;

function startAuthInitOnce(): Promise<void> {
  if (authInitPromise) return authInitPromise;

  authInitPromise = (async () => {
    let initialSessionSeen = false;
    let initialAuthBootstrapInFlight = false;

    const sync = async (nextSession: Session | null) => {
      const next = await applySessionForApp(nextSession, {
        allowUnconfirmedForRecovery: passwordRecoveryPendingRef.current,
      });
      setSnapshot({
        session: next.session,
        user: next.user,
        isRelationshipValidation: readIsRelationshipValidation(next.user),
      });
    };

    const finishInitialAuthLoad = () => {
      if (initialSessionSeen) return;
      initialSessionSeen = true;
      setSnapshot({ loading: false });
    };

    const finishInitialAuthLoadAfterSync = (nextSession: Session | null, skipSync: boolean) => {
      if (initialSessionSeen || initialAuthBootstrapInFlight) return;
      initialAuthBootstrapInFlight = true;
      if (skipSync) {
        finishInitialAuthLoad();
        return;
      }
      void sync(nextSession).finally(finishInitialAuthLoad);
    };

    supabase.auth.onAuthStateChange((event, nextSession) => {
      const { pathname, search, hash } =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location
          : { pathname: '', search: '', hash: '' };
      let skipSessionSync = false;

      if (event === 'PASSWORD_RECOVERY') {
        const signupConfirmLoad = initialWebAuthCallback.signupConfirmAtLoad;
        const confirmLink = signupConfirmLoad || isEmailConfirmationCallback();
        const explicitRecovery =
          passwordRecoveryPendingRef.current ||
          hasExplicitWebPasswordRecoveryContext(
            pathname,
            search,
            hash,
            initialWebAuthCallback.intent,
          );
        if (confirmLink || signupConfirmLoad) {
          passwordRecoveryPendingRef.current = false;
          setSnapshot({
            passwordRecoveryPending: false,
            passwordRecoveryLinkError: null,
            emailConfirmationLinkError: null,
          });
          clearPasswordResetPendingInStorage();
          skipSessionSync = true;
          webAuthCallbackAtLoadRef.current = false;
        } else if (!explicitRecovery) {
          passwordRecoveryPendingRef.current = false;
          setSnapshot({
            passwordRecoveryPending: false,
            passwordRecoveryLinkError: null,
            emailConfirmationLinkError: null,
          });
          clearPasswordResetPendingInStorage();
          webAuthCallbackAtLoadRef.current = false;
          skipSessionSync = true;
          void supabase.auth.signOut();
        } else if (explicitRecovery) {
          passwordRecoveryPendingRef.current = true;
          setSnapshot({
            passwordRecoveryPending: true,
            passwordRecoveryLinkError: null,
            emailConfirmationLinkError: null,
          });
          clearPasswordResetPendingInStorage();
          webAuthCallbackAtLoadRef.current = false;
        }
      } else if (event === 'SIGNED_IN' && webAuthCallbackAtLoadRef.current) {
        if (passwordRecoveryPendingRef.current) {
          setSnapshot({
            passwordRecoveryPending: true,
            passwordRecoveryLinkError: null,
            emailConfirmationLinkError: null,
          });
        } else {
          clearPasswordResetPendingInStorage();
          setSnapshot({
            passwordRecoveryPending: false,
            passwordRecoveryLinkError: null,
            emailConfirmationLinkError: null,
          });
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const confirmedViaEmailLink = isEmailConfirmationCallback();
            window.history.replaceState(null, '', confirmedViaEmailLink ? '/?confirmEmail=1' : '/');
          }
        }
        webAuthCallbackAtLoadRef.current = false;
      }

      if (
        event === 'INITIAL_SESSION' ||
        event === 'PASSWORD_RECOVERY' ||
        event === 'SIGNED_IN'
      ) {
        if (!initialSessionSeen) {
          finishInitialAuthLoadAfterSync(nextSession, skipSessionSync);
        } else if (!skipSessionSync) {
          void sync(nextSession);
        }
      } else if (!skipSessionSync) {
        void sync(nextSession);
      }
    });

    await bootstrapWebAuthFromUrl();
    if (Platform.OS !== 'web') {
      try {
        const initialUrl = await ExpoLinking.getInitialURL();
        await bootstrapNativeAuthFromUrl(initialUrl);
      } catch (err) {
        console.warn('[Auth] native initial URL bootstrap failed:', err);
      }
      ExpoLinking.addEventListener('url', ({ url }) => {
        void bootstrapNativeAuthFromUrl(url);
      });
    }
    authBootstrapCompleteRef.current = true;

    const {
      data: { session: bootstrapSession },
    } = await supabase.auth.getSession();
    if (!initialSessionSeen && !initialAuthBootstrapInFlight) {
      finishInitialAuthLoadAfterSync(bootstrapSession, false);
    }
  })();

  return authInitPromise;
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
    clearPasswordResetPendingInStorage();
    setSnapshot({ emailConfirmationLinkError: null });
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
    if (options?.inviteCode) {
      const trimmed = options.inviteCode.trim();
      metadata.referral_code = trimmed;
      if (isRelationshipValidationReferralCode(trimmed)) {
        metadata.is_relationship_validation = true;
      }
    }
    if (typeof options?.age === 'number') metadata.age = options.age;
    if (options?.gender) metadata.gender = options.gender;

    await supabase.auth.signOut();
    clearPasswordResetPendingInStorage();
    passwordRecoveryPendingRef.current = false;
    setSnapshot({
      passwordRecoveryPending: false,
      passwordRecoveryLinkError: null,
      emailConfirmationLinkError: null,
    });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: Object.keys(metadata).length ? metadata : undefined,
        emailRedirectTo: getAuthEmailRedirectTo(),
      },
    });
    if (error) throw error;
    clearPasswordResetPendingInStorage();
    if (data.user == null) {
      throw new Error('An account with this email already exists. Sign in instead.');
    }
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('An account with this email already exists. Sign in instead.');
    }
    return data;
  };

  const signOut = async () => {
    clearPasswordResetPendingInStorage();
    passwordRecoveryPendingRef.current = false;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resendConfirmationEmail = async (email: string) => {
    clearPasswordResetPendingInStorage();
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
        'Your reset session is missing. Open the latest link from your email in the Amoraea app, then try again.',
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

  const clearEmailConfirmationLinkError = () => {
    setSnapshot({ emailConfirmationLinkError: null });
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
    clearEmailConfirmationLinkError,
  };
};
