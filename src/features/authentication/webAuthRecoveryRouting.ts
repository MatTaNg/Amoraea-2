import { Platform } from 'react-native';

export const PASSWORD_RESET_PENDING_STORAGE_KEY = 'amoraea_password_reset_pending';
export const PASSWORD_RESET_PENDING_TTL_MS = 30 * 60 * 1000;

export type WebAuthHashError = {
  code: string;
  description: string;
};

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

export function hasWebAuthCallbackQuery(search: string): boolean {
  if (!search || search === '?') return false;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return Boolean(params.get('code') || params.get('token_hash'));
}

export function hasRecoveryAuthHash(hash: string): boolean {
  if (!hash) return false;
  const h = hash.toLowerCase();
  if (h.includes('type=recovery')) return true;
  if (h.includes('access_token') && !h.includes('error=')) return true;
  return (
    h.includes('error_code=otp_expired') ||
    h.includes('error_code=otp_disabled') ||
    h.includes('error_code=validation_failed')
  );
}

export function hasWebAuthCallbackInUrl(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const { search, hash } = window.location;
  return hasWebAuthCallbackQuery(search) || hasRecoveryAuthHash(hash);
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

/** True when the current URL is a password-reset email callback (success or failure). */
export function isWebPasswordRecoveryCallback(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const { pathname, search, hash } = window.location;
  if (hasWebAuthCallbackQuery(search) || hasRecoveryAuthHash(hash)) return true;
  if (isPasswordResetPendingInStorage() && !pathname.includes('reset-password')) return true;
  return false;
}

/** Keep the auth stack on SetNewPassword instead of the logged-in interview shell. */
export function shouldForceWebPasswordResetUi(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const { pathname } = window.location;
  if (pathname.includes('reset-password')) return true;
  if (hasWebAuthCallbackInUrl()) return true;
  if (isPasswordResetPendingInStorage()) return true;
  return false;
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

/** Runs before React — rewrite wrong Supabase redirects (e.g. Site URL `/welcome`) to `/reset-password`. */
export function bootstrapWebPasswordRecoveryUrlFromWindow(): void {
  if (typeof window === 'undefined') return;
  normalizeWebPasswordRecoveryUrl();
}

export function readInitialWebPasswordRecoveryState(): {
  pending: boolean;
  linkError: string | null;
} {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { pending: false, linkError: null };
  }
  normalizeWebPasswordRecoveryUrl();
  if (!shouldForceWebPasswordResetUi() && !hasWebAuthCallbackInUrl()) {
    return { pending: false, linkError: null };
  }
  const hashErr = parseWebAuthHashError(window.location.hash);
  return {
    pending: true,
    linkError: webPasswordRecoveryLinkErrorMessage(hashErr),
  };
}
