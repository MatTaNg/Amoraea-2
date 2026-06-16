/**
 * Node-safe Anthropic messages client for batch scripts (no Expo / React Native).
 */
const DEFAULT_MODEL = 'claude-sonnet-4-6';

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

export function getAnthropicEndpointForScript(): string {
  const configured = env('EXPO_PUBLIC_ANTHROPIC_PROXY_URL') || env('ANTHROPIC_PROXY_URL');
  if (configured) return configured;
  const supabaseUrl = (env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL')).replace(/\/+$/, '');
  return supabaseUrl
    ? `${supabaseUrl}/functions/v1/anthropic-proxy`
    : 'https://api.anthropic.com/v1/messages';
}

export function getAnthropicHeadersForScript(): Record<string, string> {
  const apiUrl = getAnthropicEndpointForScript();
  const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useProxy) {
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    const anon = env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
    const token = serviceKey || anon;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      if (anon) headers.apikey = anon;
    }
  } else {
    const key = env('EXPO_PUBLIC_ANTHROPIC_API_KEY') || env('ANTHROPIC_API_KEY');
    if (key) {
      headers['x-api-key'] = key;
      headers['anthropic-version'] = '2023-06-01';
    }
  }
  return headers;
}

export type AnthropicCallOptions = {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  timeoutMs?: number;
};

export async function callAnthropicUserPrompt(
  prompt: string,
  opts?: AnthropicCallOptions,
): Promise<string> {
  const apiUrl = getAnthropicEndpointForScript();
  const headers = getAnthropicHeadersForScript();
  if (!headers.Authorization && !headers['x-api-key']) {
    throw new Error(
      'Missing Anthropic credentials: set ANTHROPIC_API_KEY or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for proxy',
    );
  }
  const controller = new AbortController();
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: opts?.model ?? DEFAULT_MODEL,
        max_tokens: opts?.maxTokens ?? 1200,
        temperature: opts?.temperature ?? 0,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = (await res.json()) as {
      content?: Array<{ text?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(data?.error?.message ?? `Anthropic HTTP ${res.status}`);
    }
    return (data.content?.[0]?.text ?? '').trim();
  } finally {
    clearTimeout(timer);
  }
}
