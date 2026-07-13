import Constants from 'expo-constants';

import { supabase } from '@data/supabase/client';

function readExpoExtraRecords(): {
  extra?: Record<string, unknown>;
  legacy?: Record<string, unknown>;
  manifest2?: Record<string, unknown>;
  easConfig?: Record<string, unknown>;
} {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const legacy =
    (Constants as unknown as { manifest?: { extra?: Record<string, unknown> } }).manifest?.extra;
  const manifest2 =
    (
      Constants as unknown as {
        manifest2?: { extra?: { expoClient?: { extra?: Record<string, unknown> } } };
      }
    ).manifest2?.extra?.expoClient?.extra;
  const easConfig = (Constants as unknown as { easConfig?: Record<string, unknown> }).easConfig;
  return { extra, legacy, manifest2, easConfig };
}

export function getResolvedSupabaseUrl(): string {
  const { extra, legacy, manifest2, easConfig } = readExpoExtraRecords();
  const fromProcess =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL) || '';
  const fromConfig =
    (extra?.supabaseUrl as string | undefined) ??
    (extra?.EXPO_PUBLIC_SUPABASE_URL as string | undefined) ??
    (legacy?.supabaseUrl as string | undefined) ??
    (legacy?.EXPO_PUBLIC_SUPABASE_URL as string | undefined) ??
    (manifest2?.supabaseUrl as string | undefined) ??
    (manifest2?.EXPO_PUBLIC_SUPABASE_URL as string | undefined) ??
    (easConfig?.supabaseUrl as string | undefined) ??
    (easConfig?.EXPO_PUBLIC_SUPABASE_URL as string | undefined) ??
    '';
  const fromEnv = (fromProcess || fromConfig).trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  const maybeSupabase = supabase as unknown as { supabaseUrl?: string; rest?: { url?: string } };
  if (typeof maybeSupabase.supabaseUrl === 'string' && maybeSupabase.supabaseUrl.trim()) {
    return maybeSupabase.supabaseUrl.trim().replace(/\/+$/, '');
  }
  const restUrl = maybeSupabase.rest?.url;
  if (typeof restUrl === 'string' && restUrl.trim()) {
    return restUrl.replace(/\/rest\/v1\/?$/, '').trim().replace(/\/+$/, '');
  }
  return '';
}

export function getTtsProxyUrl(): string {
  const explicit =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ELEVENLABS_TTS_PROXY_URL) ||
    (Constants.expoConfig?.extra as { elevenLabsTtsProxyUrl?: string; EXPO_PUBLIC_ELEVENLABS_TTS_PROXY_URL?: string } | undefined)?.elevenLabsTtsProxyUrl ||
    (Constants.expoConfig?.extra as { elevenLabsTtsProxyUrl?: string; EXPO_PUBLIC_ELEVENLABS_TTS_PROXY_URL?: string } | undefined)?.EXPO_PUBLIC_ELEVENLABS_TTS_PROXY_URL ||
    '';
  if (explicit.trim()) return explicit.trim();
  const supabaseUrl = getResolvedSupabaseUrl();
  return supabaseUrl ? `${supabaseUrl}/functions/v1/elevenlabs-tts-proxy` : '';
}

/** Same pattern as AriaScreen whisper proxy — Supabase gateway requires Bearer anon or session JWT. */
export function getResolvedSupabaseAnonKey(): string {
  const { extra, legacy, manifest2, easConfig } = readExpoExtraRecords();
  const fromProcess =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY) || '';
  const fromConfig =
    (extra?.supabaseAnonKey as string | undefined) ??
    (extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
    (legacy?.supabaseAnonKey as string | undefined) ??
    (legacy?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
    (manifest2?.supabaseAnonKey as string | undefined) ??
    (manifest2?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
    (easConfig?.supabaseAnonKey as string | undefined) ??
    (easConfig?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
    '';
  const fromEnv = (fromProcess || fromConfig).trim();
  if (fromEnv) return fromEnv;
  const maybeSupabase = supabase as unknown as {
    supabaseKey?: string;
    rest?: { headers?: Record<string, string> };
  };
  const fromClientKey = typeof maybeSupabase.supabaseKey === 'string' ? maybeSupabase.supabaseKey.trim() : '';
  if (fromClientKey) return fromClientKey;
  const fromRestHeader = (
    maybeSupabase.rest?.headers?.apikey ??
    maybeSupabase.rest?.headers?.Authorization ??
    ''
  )
    .replace(/^Bearer\s+/i, '')
    .trim();
  return fromRestHeader;
}

export async function buildSupabaseEdgeFunctionAuthHeaders(): Promise<Record<string, string>> {
  const anon = getResolvedSupabaseAnonKey();
  if (anon) {
    return { Authorization: `Bearer ${anon}`, apikey: anon };
  }
  const sessionResult = await supabase.auth.getSession().catch(() => null);
  const token = sessionResult?.data?.session?.access_token?.trim();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

export function getElevenLabsApiKey(): string {
  const fromProcess =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ELEVENLABS_API_KEY) || '';
  const { extra, legacy, manifest2, easConfig } = readExpoExtraRecords();
  const fromConfig =
    (extra?.elevenLabsApiKey as string | undefined) ??
    (extra?.EXPO_PUBLIC_ELEVENLABS_API_KEY as string | undefined) ??
    (legacy?.elevenLabsApiKey as string | undefined) ??
    (legacy?.EXPO_PUBLIC_ELEVENLABS_API_KEY as string | undefined) ??
    (manifest2?.elevenLabsApiKey as string | undefined) ??
    (manifest2?.EXPO_PUBLIC_ELEVENLABS_API_KEY as string | undefined) ??
    (easConfig?.elevenLabsApiKey as string | undefined) ??
    (easConfig?.EXPO_PUBLIC_ELEVENLABS_API_KEY as string | undefined) ??
    '';
  return (fromProcess || fromConfig).trim();
}
