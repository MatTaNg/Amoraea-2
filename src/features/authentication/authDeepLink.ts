import { Platform } from 'react-native';
import * as ExpoLinking from 'expo-linking';

import {
  AUTH_EMAIL_CONFIRM_PATH,
  AUTH_PASSWORD_RESET_PATH,
} from '@features/authentication/webAuthRecoveryRouting';

/** Custom scheme registered in `app.json` — must match Supabase redirect allowlist. */
export const AUTH_APP_SCHEME = 'amoraea';

/**
 * Parse an auth callback URL (https or custom scheme) into web-style location parts
 * so the same verify/exchange bootstrap can run on native and web.
 */
export function parseAuthCallbackUrl(url: string): {
  pathname: string;
  search: string;
  hash: string;
} {
  const trimmed = url.trim();
  if (!trimmed) {
    return { pathname: '/', search: '', hash: '' };
  }

  try {
    const u = new URL(trimmed);
    let pathname = u.pathname || '/';
    // Custom schemes often put the first path segment in `hostname`
    // e.g. amoraea://auth/confirm → host=auth, path=/confirm
    if (u.protocol !== 'http:' && u.protocol !== 'https:' && u.hostname) {
      const hostPart = u.hostname.replace(/^\/+|\/+$/g, '');
      const rest = pathname === '/' ? '' : pathname;
      pathname = `/${hostPart}${rest}`;
    }
    if (!pathname.startsWith('/')) pathname = `/${pathname}`;
    return {
      pathname,
      search: u.search || '',
      hash: u.hash || '',
    };
  } catch {
    const parsed = ExpoLinking.parse(trimmed);
    const path = (parsed.path ?? '').replace(/^\/+/, '');
    const host = (parsed.hostname ?? '').replace(/^\/+|\/+$/g, '');
    const pathname = `/${[host, path].filter(Boolean).join('/')}`.replace(/\/+/g, '/') || '/';
    const qp = parsed.queryParams ?? {};
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(qp)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item != null) searchParams.append(key, String(item));
        }
      } else {
        searchParams.set(key, String(value));
      }
    }
    const search = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return { pathname, search, hash: '' };
  }
}

export function isAuthCallbackDeepLink(url: string): boolean {
  const { pathname, search, hash } = parseAuthCallbackUrl(url);
  const haystack = `${pathname}${search}${hash}`.toLowerCase();
  return (
    haystack.includes('auth/confirm') ||
    haystack.includes('auth/reset-password') ||
    haystack.includes('confirm-email') ||
    haystack.includes('reset-password') ||
    haystack.includes('token_hash=') ||
    haystack.includes('type=recovery') ||
    haystack.includes('type=signup') ||
    /[?#&]code=/.test(haystack) ||
    haystack.includes('access_token=')
  );
}

/** Stable native deep-link base (`amoraea://`) for production builds / redirect allowlists. */
export function getNativeAuthDeepLinkOrigin(): string {
  return `${AUTH_APP_SCHEME}://`;
}

/**
 * Site origin for web auth redirects (never an in-app route).
 * Native callers should use {@link getAuthEmailRedirectTo} / {@link getPasswordResetRedirectTo}.
 */
export function getAuthWebSiteOrigin(): string {
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
  if (Platform.OS !== 'web') {
    // Stable scheme for Supabase allowlist (not Expo Go ephemeral URLs).
    return `${getNativeAuthDeepLinkOrigin()}auth/confirm`;
  }
  return `${getAuthWebSiteOrigin()}${AUTH_EMAIL_CONFIRM_PATH}`;
}

export function getPasswordResetRedirectTo(): string {
  if (Platform.OS !== 'web') {
    return `${getNativeAuthDeepLinkOrigin()}auth/reset-password`;
  }
  return `${getAuthWebSiteOrigin()}${AUTH_PASSWORD_RESET_PATH}`;
}
