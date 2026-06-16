import { Platform } from 'react-native';

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
  if (!pathname.includes('reset-password')) return;
  if (isWebPasswordRecoveryCallback()) return;
  if (!isEmailConfirmationContext(pathname, search, hash)) return;
  window.history.replaceState(null, '', `/confirm-email${search}${hash}`);
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

  // Expired/invalid links on `/reset-password` are recovery only when the user requested a reset.
  if (pathname.includes('reset-password')) {
    return isPasswordResetPendingInStorage() || h.includes('type=recovery');
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
    path === '/confirm-email'
  );
}

/** True when URL context is signup / email confirm — not password recovery. */
export function isEmailConfirmationContext(
  pathname: string,
  search: string,
  hash: string,
): boolean {
  const h = hash.toLowerCase();
  if (h.includes('type=recovery')) return false;
  if (hasEmailConfirmationAuthHash(hash)) return true;
  if (hasEmailConfirmationAuthQuery(search)) return true;
  if (isEmailConfirmationLandingPath(pathname)) return true;
  if (hasWebAuthCallbackQuery(search) && !pathname.includes('reset-password')) return true;
  return false;
}

export function hasEmailConfirmationAuthQuery(search: string): boolean {
  if (!search || search === '?') return false;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const type = params.get('type')?.toLowerCase() ?? '';
  return EMAIL_CONFIRMATION_HASH_TYPES.has(type);
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
  if (pathname.includes('reset-password')) return;
  window.history.replaceState(null, '', `/reset-password${search}${hash}`);
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
  if (!isWebPasswordRecoveryCallback()) {
    return { pending: false, linkError: null, emailConfirmationLinkError: null };
  }
  normalizeWebPasswordRecoveryUrl();
  return {
    pending: true,
    linkError: webPasswordRecoveryLinkErrorMessage(hashErr),
    emailConfirmationLinkError: null,
  };
}
