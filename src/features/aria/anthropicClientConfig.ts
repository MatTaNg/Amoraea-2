import Constants from 'expo-constants';

import { supabase } from '@data/supabase/client';

export const ANTHROPIC_DIRECT_API_URL = 'https://api.anthropic.com/v1/messages';

function getPublicEnv(varName: string, extraKey?: string): string {
  const fromProcess =
    typeof process !== 'undefined' && process.env ? (process.env[varName] as string | undefined) : undefined;
  const expoConfigExtra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const legacyManifestExtra =
    (Constants as unknown as { manifest?: { extra?: Record<string, unknown> } }).manifest?.extra;
  const manifest2Extra =
    (
      Constants as unknown as {
        manifest2?: { extra?: { expoClient?: { extra?: Record<string, unknown> } } };
      }
    ).manifest2?.extra?.expoClient?.extra;
  const easConfig = (Constants as unknown as { easConfig?: Record<string, unknown> }).easConfig;
  const key = extraKey ?? '';
  const fromConfig =
    (typeof key === 'string' && key ? (expoConfigExtra?.[key] as string | undefined) : undefined) ??
    (expoConfigExtra?.[varName] as string | undefined) ??
    (typeof key === 'string' && key ? (legacyManifestExtra?.[key] as string | undefined) : undefined) ??
    (legacyManifestExtra?.[varName] as string | undefined) ??
    (typeof key === 'string' && key ? (manifest2Extra?.[key] as string | undefined) : undefined) ??
    (manifest2Extra?.[varName] as string | undefined) ??
    (typeof key === 'string' && key ? (easConfig?.[key] as string | undefined) : undefined) ??
    (easConfig?.[varName] as string | undefined);
  return (fromProcess || fromConfig || '').trim();
}

export function getResolvedSupabaseUrl(): string {
  const configured = getPublicEnv('EXPO_PUBLIC_SUPABASE_URL', 'supabaseUrl');
  if (configured) return configured;
  const maybeSupabase = supabase as unknown as { supabaseUrl?: string; rest?: { url?: string } };
  if (typeof maybeSupabase.supabaseUrl === 'string' && maybeSupabase.supabaseUrl.trim()) {
    return maybeSupabase.supabaseUrl.trim();
  }
  const restUrl = maybeSupabase.rest?.url;
  if (typeof restUrl === 'string' && restUrl.trim()) {
    return restUrl.replace(/\/rest\/v1\/?$/, '').trim();
  }
  return '';
}

function getResolvedAnthropicProxyUrl(): string {
  const configured = getPublicEnv('EXPO_PUBLIC_ANTHROPIC_PROXY_URL', 'anthropicProxyUrl');
  if (configured) return configured;
  const supabaseUrl = getResolvedSupabaseUrl().replace(/\/+$/, '');
  return supabaseUrl ? `${supabaseUrl}/functions/v1/anthropic-proxy` : '';
}

function getResolvedSupabaseAnonKey(): string {
  const configured = getPublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'supabaseAnonKey');
  if (configured) return configured;
  const maybeSupabase = supabase as unknown as {
    supabaseKey?: string;
    rest?: { headers?: Record<string, string> };
  };
  const fromClientKey = typeof maybeSupabase.supabaseKey === 'string' ? maybeSupabase.supabaseKey.trim() : '';
  if (fromClientKey) return fromClientKey;
  const fromRestHeader =
    (maybeSupabase.rest?.headers?.apikey ?? maybeSupabase.rest?.headers?.Authorization ?? '')
      .replace(/^Bearer\s+/i, '')
      .trim();
  return fromRestHeader;
}

export function getAnthropicEndpoint(): string {
  const proxyUrl = getResolvedAnthropicProxyUrl();
  if (!proxyUrl && __DEV__) {
    console.warn('Anthropic proxy URL is not set; direct API may fail on native.');
  }
  return proxyUrl || ANTHROPIC_DIRECT_API_URL;
}

export function isAnthropicProxyEndpoint(apiUrl: string): boolean {
  return apiUrl !== '' && apiUrl !== ANTHROPIC_DIRECT_API_URL;
}

export const ANTHROPIC_API_KEY = getPublicEnv('EXPO_PUBLIC_ANTHROPIC_API_KEY', 'anthropicApiKey');
export const ANTHROPIC_PROXY_URL = getResolvedAnthropicProxyUrl();
export const SUPABASE_ANON_KEY = getResolvedSupabaseAnonKey();

export { getPublicEnv, getResolvedSupabaseAnonKey, getResolvedAnthropicProxyUrl };

export type BuildAnthropicMessagesHeadersOptions = {
  apiUrl: string;
  /** When true, proxy requests include both Authorization and apikey (reasoning gateway). */
  includeProxyApiKey?: boolean;
  /** When false, omit direct API headers if the Anthropic key is empty (scoreInterview path). */
  includeDirectHeadersWithoutKey?: boolean;
};

export function buildAnthropicMessagesHeaders(
  options: BuildAnthropicMessagesHeadersOptions,
): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const useProxy = isAnthropicProxyEndpoint(options.apiUrl);
  if (useProxy) {
    const anon = SUPABASE_ANON_KEY?.trim();
    if (anon) {
      headers['Authorization'] = `Bearer ${anon}`;
      if (options.includeProxyApiKey) headers['apikey'] = anon;
    }
    return headers;
  }
  if (ANTHROPIC_API_KEY || options.includeDirectHeadersWithoutKey !== false) {
    headers['x-api-key'] = ANTHROPIC_API_KEY;
    headers['anthropic-version'] = '2023-06-01';
  }
  return headers;
}
