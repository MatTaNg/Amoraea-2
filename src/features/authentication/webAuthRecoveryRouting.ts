import { Platform } from 'react-native';
import {
  debugAuthCallbackLog,
  sanitizeAuthUrlForLog,
} from './debugAuthCallbackLog';

/** Supabase `emailRedirectTo` / `redirectTo` paths (must match Supabase redirect URL allowlist). */
export const AUTH_EMAIL_CONFIRM_PATH = '/auth/confirm';
export const AUTH_PASSWORD_RESET_PATH = '/auth/reset-password';

/** Legacy paths kept for email links sent before `/auth/*` redirect URLs. */
export const LEGACY_EMAIL_CONFIRM_PATH = '/confirm-email';
export const LEGACY_PASSWORD_RESET_PATH = '/reset-password';

export function isAuthEmailConfirmPath(pathname: string): boolean {
  return (
    pathname.includes(AUTH_EMAIL_CONFIRM_PATH) ||
    pathname.includes(LEGACY_EMAIL_CONFIRM_PATH)
  );
}

export function isAuthPasswordResetPath(pathname: string): boolean {
  return (
    pathname.includes(AUTH_PASSWORD_RESET_PATH) ||
    pathname.includes(LEGACY_PASSWORD_RESET_PATH)
  );
}

export const PASSWORD_RESET_PENDING_STORAGE_KEY = 'amoraea_password_reset_pending';
export const PASSWORD_RESET_PENDING_TTL_MS = 30 * 60 * 1000;

export type WebAuthHashError = {
  code: string;
  description: string;
};

const EMAIL_CONFIRMATION_HASH_TYPES = new Set([
  'signup',
  'email',
  'email_change',
  'invite',
]);

/** Parse Supabase auth errors returned in the URL hash after email link click. */
export function parseWebAuthHashError(hash: string): WebAuthHashError | null {
  if (!hash || !hash.startsWith('#')) return null;
  const params = new URLSearchParams(hash.slice(1));
  const error = params.get('error');
  if (!error) return null;
  const descriptionRaw = params.get('error_description') ?? '';
  return {
    code: params.get('error_code') ?? error,
    description: decodeURIComponent(descriptionRaw.replace(/\+/g, ' ')).trim(),
  };
}

export function parseAuthHashType(hash: string): string | null {
  if (!hash || !hash.startsWith('#')) return null;
  return new URLSearchParams(hash.slice(1)).get('type');
}

export function hasWebAuthCallbackQuery(search: string): boolean {
  if (!search || search === '?') return false;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return Boolean(params.get('code') || params.get('token_hash'));
}

export function hasImplicitAuthHash(hash: string): boolean {
  if (!hash) return false;
  const h = hash.toLowerCase();
  return h.includes('access_token') && !h.includes('error=');
}

export function hasEmailConfirmationAuthHash(hash: string): boolean {
  const type = parseAuthHashType(hash)?.toLowerCase() ?? '';
  return EMAIL_CONFIRMATION_HASH_TYPES.has(type);
}

/** Rewrite signup/confirm callbacks off `/reset-password` before React auth bootstrap. */
export function normalizeWebEmailConfirmationUrl(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const { pathname, search, hash } = window.location;
  const onReset = isAuthPasswordResetPath(pathname);
  const recoveryCb = isWebPasswordRecoveryCallback();
  const confirmCtx = isEmailConfirmationContext(pathname, search, hash);
  // #region agent log
  debugAuthCallbackLog(
    'webAuthRecoveryRouting.ts:normalizeWebEmailConfirmationUrl',
    'normalize confirm URL decision',
    {
      ...sanitizeAuthUrlForLog(pathname, search, hash),
      onReset,
      recoveryCb,
      confirmCtx,
      resetPending: isPasswordResetPendingInStorage(),
      intent: resolveWebAuthCallbackIntent(pathname, search, hash),
    },
    'H4',
  );
  // #endregion
  if (!onReset) return;
  if (recoveryCb) return;
  if (!confirmCtx) return;
  const target = `${AUTH_EMAIL_CONFIRM_PATH}${search}${hash}`;
  const current = `${pathname}${search}${hash}`;
  if (current !== target) {
    // #region agent log
    debugAuthCallbackLog(
      'webAuthRecoveryRouting.ts:normalizeWebEmailConfirmationUrl',
      'redirecting reset path to confirm',
      { targetPath: AUTH_EMAIL_CONFIRM_PATH },
      'H4',
    );
    // #endregion
    window.location.replace(target);
  }
}

export function hasRecoveryAuthHash(
  hash: string,
  ctx?: { pathname?: string; search?: string },
): boolean {
  if (!hash) return false;
  const h = hash.toLowerCase();
  if (h.includes('type=recovery')) return true;

  const pathname =
    ctx?.pathname ??
    (Platform.OS === 'web' && typeof window !== 'undefined' ? (window.location?.pathname ?? '') : '');
  const search =
    ctx?.search ??
    (Platform.OS === 'web' && typeof window !== 'undefined' ? (window.location?.search ?? '') : '');

  if (isEmailConfirmationContext(pathname, search, hash)) return false;

  if (!h.includes('error=')) return false;

  // Expired/invalid links on reset-password are recovery only when explicitly typed as recovery.
  if (isAuthPasswordResetPath(pathname)) {
    return (
      h.includes('type=recovery') || hasExplicitRecoveryAuthQuery(search)
    );
  }

  return (
    h.includes('error_code=otp_expired') ||
    h.includes('error_code=otp_disabled') ||
    h.includes('error_code=validation_failed')
  );
}

export function isEmailConfirmationLandingPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return (
    path === '/' ||
    path === '/login' ||
    path === '/register' ||
    path === '/welcome' ||
    path === AUTH_EMAIL_CONFIRM_PATH ||
    path === LEGACY_EMAIL_CONFIRM_PATH
  );
}

/** Post-confirm success banner on Login (`/?confirmEmail=1`). */
export function hasPostEmailConfirmLandingQuery(search: string): boolean {
  if (!search || search === '?') return false;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const v = params.get('confirmEmail');
  return v === '1' || v === 'true';
}

/** True when URL context is signup / email confirm — not password recovery. */
export function isEmailConfirmationContext(
  pathname: string,
  search: string,
  hash: string,
): boolean {
  const h = hash.toLowerCase();
  if (h.includes('type=recovery')) return false;
  if (hasPostEmailConfirmLandingQuery(search)) return true;
  if (hasEmailConfirmationAuthHash(hash)) return true;
  if (hasEmailConfirmationAuthQuery(search)) return true;
  if (isAuthEmailConfirmPath(pathname)) return true;
  if (hasWebAuthCallbackQuery(search)) {
    if (!isAuthPasswordResetPath(pathname)) return true;
    if (hasExplicitRecoveryAuthContext(search, hash)) return false;
    return true;
  }
  if (
    isAuthPasswordResetPath(pathname) &&
    hasImplicitAuthHash(hash) &&
    !h.includes('type=recovery')
  ) {
    return true;
  }
  return false;
}

export function hasEmailConfirmationAuthQuery(search: string): boolean {
  if (!search || search === '?') return false;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const type = params.get('type')?.toLowerCase() ?? '';
  return EMAIL_CONFIRMATION_HASH_TYPES.has(type);
}

export type WebAuthCallbackIntent = 'confirm' | 'recovery' | null;

const CONFIRM_EMAIL_TOKEN_TYPES = new Set(['signup', 'email', 'email_change', 'invite']);

export function isConfirmEmailTokenType(type: string | null | undefined): boolean {
  if (!type) return false;
  return CONFIRM_EMAIL_TOKEN_TYPES.has(type.toLowerCase());
}

/** Snapshot at module load — signup confirm must not be treated as password recovery. */
export function isSignupConfirmAtLoad(
  intent: WebAuthCallbackIntent,
  tokenType: string | null,
  pathname: string,
): boolean {
  if (intent === 'confirm') return true;
  if (isConfirmEmailTokenType(tokenType)) return true;
  return isAuthEmailConfirmPath(pathname);
}

export function readAuthCallbackTokenType(search: string, hash: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return (params.get('type') || parseAuthHashType(hash))?.toLowerCase() ?? null;
}

/** Classify auth callback from URL before Supabase session exchange. */
export function resolveWebAuthCallbackIntent(
  pathname: string,
  search: string,
  hash: string,
): WebAuthCallbackIntent {
  const tokenType = readAuthCallbackTokenType(search, hash);
  if (tokenType === 'recovery') return 'recovery';
  if (isConfirmEmailTokenType(tokenType)) return 'confirm';
  if (hasEmailConfirmationAuthHash(hash)) return 'confirm';
  if (hasEmailConfirmationAuthQuery(search)) return 'confirm';
  if (isAuthEmailConfirmPath(pathname) && (hasWebAuthCallbackQuery(search) || hasImplicitAuthHash(hash))) {
    return 'confirm';
  }
  if (hasWebAuthCallbackQuery(search)) {
    if (hasExplicitRecoveryAuthContext(search, hash)) return 'recovery';
    if (isAuthPasswordResetPath(pathname)) return 'confirm';
    return 'confirm';
  }
  if (
    isAuthPasswordResetPath(pathname) &&
    hasImplicitAuthHash(hash) &&
    !hash.toLowerCase().includes('type=recovery')
  ) {
    return 'confirm';
  }
  return null;
}

export function shouldArmPasswordRecoveryUi(
  intent: WebAuthCallbackIntent,
  pathname?: string,
  search?: string,
  hash?: string,
): boolean {
  if (intent === 'confirm') return false;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const path = pathname ?? window.location.pathname;
    const q = search ?? window.location.search;
    const h = hash ?? window.location.hash;
    const tokenType = readAuthCallbackTokenType(q, h);
    if (isConfirmEmailTokenType(tokenType)) return false;
    if (isEmailConfirmationContext(path, q, h) && !isPasswordResetPendingInStorage()) return false;
  }
  return intent === 'recovery';
}

/** True when the URL (or forgot-password flow) explicitly requested password recovery. */
export function hasExplicitWebPasswordRecoveryContext(
  pathname: string,
  search: string,
  hash: string,
  intent?: WebAuthCallbackIntent | null,
): boolean {
  if (intent === 'recovery') return true;
  if (hasExplicitRecoveryAuthContext(search, hash)) return true;
  // Pending flag alone must not arm recovery on `/` or confirm paths — only on reset landing.
  if (isPasswordResetPendingInStorage() && isAuthPasswordResetPath(pathname)) return true;
  return false;
}

/** Bare reset-password URL with no auth params — usually a misconfigured Site URL redirect. */
export function isBarePasswordResetLanding(pathname: string, search: string, hash: string): boolean {
  if (!isAuthPasswordResetPath(pathname)) return false;
  if (hasExplicitRecoveryAuthContext(search, hash)) return false;
  if (hasWebAuthCallbackQuery(search)) return false;
  if (hasImplicitAuthHash(hash)) return false;
  return true;
}

export function hasExplicitRecoveryAuthQuery(search: string): boolean {
  if (!search || search === '?') return false;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.get('type')?.toLowerCase() === 'recovery';
}

/** True when URL explicitly marks password recovery (not an ambiguous PKCE `code`). */
export function hasExplicitRecoveryAuthContext(
  search: string,
  hash: string,
): boolean {
  if (hasExplicitRecoveryAuthQuery(search)) return true;
  return parseAuthHashType(hash)?.toLowerCase() === 'recovery';
}

/** Signup / email-confirm link (not password recovery). */
export function isEmailConfirmationCallback(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const { pathname, search, hash } = window.location;
  return isEmailConfirmationContext(pathname, search, hash);
}

export function hasWebAuthCallbackInUrl(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const { search, hash } = window.location;
  return hasWebAuthCallbackQuery(search) || hasImplicitAuthHash(hash);
}

export function isPasswordResetPendingInStorage(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(PASSWORD_RESET_PENDING_STORAGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts) || Date.now() - ts > PASSWORD_RESET_PENDING_TTL_MS) {
      window.localStorage.removeItem(PASSWORD_RESET_PENDING_STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function markPasswordResetPendingInStorage(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PASSWORD_RESET_PENDING_STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearPasswordResetPendingInStorage(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PASSWORD_RESET_PENDING_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * True when the URL clearly indicates password recovery (hash only).
 * PKCE `?code=` is ambiguous until Supabase emits PASSWORD_RECOVERY vs SIGNED_IN.
 */
export function isWebPasswordRecoveryCallback(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (isEmailConfirmationCallback()) return false;
  return hasRecoveryAuthHash(window.location.hash);
}

/** Keep the auth stack on SetNewPassword instead of the logged-in interview shell. */
export function shouldForceWebPasswordResetUi(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (isEmailConfirmationCallback()) return false;
  return isWebPasswordRecoveryCallback();
}

/** Route recovery callbacks through `/reset-password` so auth linking handles them. */
export function normalizeWebPasswordRecoveryUrl(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!isWebPasswordRecoveryCallback()) return;
  const { pathname, search, hash } = window.location;
  if (isAuthPasswordResetPath(pathname)) return;
  window.history.replaceState(null, '', `${AUTH_PASSWORD_RESET_PATH}${search}${hash}`);
}

export function webPasswordRecoveryLinkErrorMessage(err: WebAuthHashError | null): string | null {
  if (!err) return null;
  if (err.code === 'otp_expired') {
    return 'This reset link has expired. Request a new one below.';
  }
  if (err.description.length > 0) {
    return err.description;
  }
  return 'This reset link is invalid. Request a new reset email below.';
}

export function webEmailConfirmationLinkErrorMessage(err: WebAuthHashError | null): string | null {
  if (!err) return null;
  if (err.code === 'otp_expired') {
    return 'This confirmation link has expired or was already used. Sign in and resend a new confirmation email.';
  }
  if (err.description.length > 0) {
    return err.description;
  }
  return 'This confirmation link is invalid. Sign in and request a new confirmation email.';
}

/** Runs before React — normalize auth callback paths for recovery vs email confirm. */
export function bootstrapWebPasswordRecoveryUrlFromWindow(): void {
  if (typeof window === 'undefined') return;
  normalizeWebEmailConfirmationUrl();
  normalizeWebPasswordRecoveryUrl();
}

export function readInitialWebPasswordRecoveryState(): {
  pending: boolean;
  linkError: string | null;
  emailConfirmationLinkError: string | null;
} {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { pending: false, linkError: null, emailConfirmationLinkError: null };
  }
  const { pathname, search, hash } = window.location;
  const hashErr = parseWebAuthHashError(hash);
  if (hashErr && isEmailConfirmationContext(pathname, search, hash)) {
    return {
      pending: false,
      linkError: null,
      emailConfirmationLinkError: webEmailConfirmationLinkErrorMessage(hashErr),
    };
  }
  if (hashErr && hasExplicitRecoveryAuthContext(search, hash)) {
    return {
      pending: false,
      linkError: webPasswordRecoveryLinkErrorMessage(hashErr),
      emailConfirmationLinkError: null,
    };
  }
  // Never arm reset UI from URL alone — wait for PASSWORD_RECOVERY or explicit recovery verifyOtp.
  return { pending: false, linkError: null, emailConfirmationLinkError: null };
}
