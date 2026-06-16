import { Platform } from 'react-native';

import { supabase } from '@data/supabase/client';
import { formatEdgeFunctionInvokeFailure } from '@utilities/runCommunicationStylePipeline';
import {
  getOpenAiChatProxyEndpoint,
  getResolvedSupabaseUrl,
  getSupabaseAnonKey,
  isBrowserEnvironment,
} from '@utilities/openAiChatClient';

export type OpenAiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type OpenAiChatPayload = {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  messages: OpenAiChatMessage[];
};

function getExpoPublicOpenAiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_OPENAI_API_KEY?.trim() || undefined;
}

type OpenAiCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

function parseOpenAiCompletionResponse(data: OpenAiCompletionResponse): string {
  if (data.error?.message) {
    throw new Error(data.error.message);
  }
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('No content returned from OpenAI');
  }
  return text;
}

async function getEdgeFunctionAuthHeaders(): Promise<Record<string, string>> {
  const anonKey = getSupabaseAnonKey();
  const { data } = await supabase.auth.getSession();
  const bearer = data.session?.access_token ?? anonKey;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${bearer}`,
  };
  if (anonKey) {
    headers.apikey = anonKey;
  }
  return headers;
}

function edgeProxyNotDeployedMessage(): string {
  const projectUrl = getResolvedSupabaseUrl();
  return (
    'OpenAI chat proxy is not reachable. Deploy it with: ' +
    '`npx supabase functions deploy openai-chat-proxy` and set the OPENAI_API_KEY secret in Supabase. ' +
    (projectUrl ? `Project: ${projectUrl}` : '')
  );
}

async function invokeOpenAiViaProxyFetch(payload: OpenAiChatPayload): Promise<string> {
  const endpoint = getOpenAiChatProxyEndpoint();
  if (!endpoint || endpoint.includes('api.openai.com')) {
    throw new Error(edgeProxyNotDeployedMessage());
  }

  const headers = await getEdgeFunctionAuthHeaders();
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('CORS')
    ) {
      throw new Error(
        `${edgeProxyNotDeployedMessage()} Browser error: ${message}`,
      );
    }
    throw err;
  }

  const raw = await res.text();
  let data: OpenAiCompletionResponse;
  try {
    data = JSON.parse(raw) as OpenAiCompletionResponse;
  } catch {
    throw new Error(
      res.ok
        ? 'OpenAI proxy returned invalid JSON'
        : `OpenAI proxy failed (${res.status}): ${raw.slice(0, 240)}`,
    );
  }

  if (!res.ok) {
    throw new Error(data.error?.message ?? `OpenAI proxy failed (${res.status})`);
  }

  return parseOpenAiCompletionResponse(data);
}

async function invokeOpenAiViaFunctionsInvoke(payload: OpenAiChatPayload): Promise<string> {
  const { data, error } = await supabase.functions.invoke<OpenAiCompletionResponse>(
    'openai-chat-proxy',
    { body: payload },
  );

  if (error) {
    const detail = formatEdgeFunctionInvokeFailure('openai-chat-proxy', { error, data });
    throw new Error(detail || edgeProxyNotDeployedMessage());
  }

  if (!data || typeof data !== 'object') {
    throw new Error('OpenAI edge proxy returned an empty response');
  }

  return parseOpenAiCompletionResponse(data);
}

async function invokeOpenAiDirectNative(
  apiKey: string,
  payload: OpenAiChatPayload,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: payload.model ?? 'gpt-4o',
      max_tokens: payload.max_tokens ?? 4000,
      temperature: payload.temperature ?? 0.7,
      messages: payload.messages,
    }),
  });

  const data = (await res.json()) as OpenAiCompletionResponse;
  if (!res.ok) {
    throw new Error(data.error?.message ?? `OpenAI request failed (${res.status})`);
  }

  return parseOpenAiCompletionResponse(data);
}

function mustUseEdgeProxy(): boolean {
  return isBrowserEnvironment() || Platform.OS === 'web';
}

/**
 * Calls OpenAI chat completions for long-form report generation.
 * Browser / Expo web always uses the `openai-chat-proxy` Edge Function (never api.openai.com).
 */
export async function invokeOpenAiChat(payload: OpenAiChatPayload): Promise<string> {
  if (mustUseEdgeProxy()) {
    try {
      return await invokeOpenAiViaProxyFetch(payload);
    } catch (fetchErr) {
      try {
        return await invokeOpenAiViaFunctionsInvoke(payload);
      } catch {
        throw fetchErr;
      }
    }
  }

  const publicKey = getExpoPublicOpenAiKey();
  if (publicKey) {
    try {
      return await invokeOpenAiDirectNative(publicKey, payload);
    } catch {
      return invokeOpenAiViaProxyFetch(payload);
    }
  }

  return invokeOpenAiViaProxyFetch(payload);
}
