import Constants from 'expo-constants';

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

function getResolvedSupabaseUrl(): string {
  const configured = getPublicEnv('EXPO_PUBLIC_SUPABASE_URL', 'supabaseUrl');
  return configured.replace(/\/+$/, '');
}

export const CLAUDE_SONNET_MODEL = 'claude-sonnet-4-6';

export function getAnthropicEndpoint(): string {
  const configured = getPublicEnv('EXPO_PUBLIC_ANTHROPIC_PROXY_URL', 'anthropicProxyUrl');
  if (configured) return configured;
  const supabaseUrl = getResolvedSupabaseUrl();
  return supabaseUrl ? `${supabaseUrl}/functions/v1/anthropic-proxy` : 'https://api.anthropic.com/v1/messages';
}

export function getAnthropicRequestHeaders(): Record<string, string> {
  const apiUrl = getAnthropicEndpoint();
  const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useProxy) {
    const anon = getPublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'supabaseAnonKey');
    if (anon) headers.Authorization = `Bearer ${anon}`;
  } else {
    const key = getPublicEnv('EXPO_PUBLIC_ANTHROPIC_API_KEY', 'anthropicApiKey');
    if (key) {
      headers['x-api-key'] = key;
      headers['anthropic-version'] = '2023-06-01';
    }
  }
  return headers;
}
