import { supabase } from '@data/supabase/client';
import { formatEdgeFunctionInvokeFailure } from '@utilities/runCommunicationStylePipeline';
import { getAnthropicEndpoint, getAnthropicRequestHeaders } from '@utilities/anthropicMessagesClient';
import { withRetry } from '@utilities/withRetry';

export type AnthropicMessagesPayload = {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{ role: string; content: string }>;
};

export type AnthropicMessagesResponse = {
  content?: Array<{ text?: string }>;
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
};

function extractAnthropicErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const errField = (data as { error?: string | { message?: string } }).error;
  if (typeof errField === 'string' && errField.trim()) return errField.trim();
  if (errField && typeof errField === 'object' && typeof errField.message === 'string' && errField.message.trim()) {
    return errField.message.trim();
  }
  return fallback;
}

function throwAnthropicHttpError(status: number, bodyText: string, via: 'proxy' | 'direct'): never {
  let detail = bodyText.trim() || `HTTP ${status}`;
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    detail = extractAnthropicErrorMessage(parsed, detail);
  } catch {
    // keep raw body
  }
  const err = new Error(
    via === 'proxy'
      ? `Report generation failed (anthropic-proxy): ${detail}`
      : `Report generation failed: ${detail}`,
  );
  Object.assign(err, { status });
  throw err;
}

async function invokeAnthropicViaEdge(
  payload: AnthropicMessagesPayload,
): Promise<AnthropicMessagesResponse> {
  const { data, error } = await supabase.functions.invoke<
    AnthropicMessagesResponse | { error?: string | { message?: string } }
  >('anthropic-proxy', { body: payload });

  if (error) {
    const detail = formatEdgeFunctionInvokeFailure('anthropic-proxy', { error, data });
    const message = extractAnthropicErrorMessage(
      data,
      detail || 'Report generation failed (anthropic-proxy)',
    );
    console.error('[Anthropic] edge invoke failed:', message);
    const err = new Error(message);
    if (/ANTHROPIC_API_KEY|Invalid Anthropic API key|not set in Supabase/i.test(message)) {
      Object.assign(err, { status: 500 });
    } else if (/non-2xx|502|503|504|connection|network|timeout|reset|SendRequest|overloaded/i.test(message)) {
      Object.assign(err, { status: 502 });
    } else if (/non-2xx/i.test(detail || '')) {
      // Wrapper only — body may still describe a transient upstream failure
      const bodyMsg = extractAnthropicErrorMessage(data, '');
      Object.assign(err, {
        status: /connection|reset|SendRequest|timeout|overloaded|529/i.test(bodyMsg || message)
          ? 502
          : 500,
      });
    }
    throw err;
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Report generation failed (empty anthropic-proxy response)');
  }

  const errField = (data as { error?: string | { message?: string } }).error;
  if (errField) {
    const msg = typeof errField === 'string' ? errField : errField.message ?? 'Anthropic proxy error';
    const err = new Error(msg);
    Object.assign(err, {
      status: /connection|reset|SendRequest|timeout|network|overloaded|529/i.test(msg) ? 502 : 500,
    });
    throw err;
  }

  return data as AnthropicMessagesResponse;
}

async function invokeAnthropicViaFetch(
  payload: AnthropicMessagesPayload,
): Promise<AnthropicMessagesResponse> {
  const endpoint = getAnthropicEndpoint();
  const viaProxy = !endpoint.includes('api.anthropic.com');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: getAnthropicRequestHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      viaProxy ? '[Anthropic] proxy request failed:' : '[Anthropic] direct request failed:',
      errorText,
    );
    throwAnthropicHttpError(response.status, errorText, viaProxy ? 'proxy' : 'direct');
  }

  return (await response.json()) as AnthropicMessagesResponse;
}

/**
 * Calls Claude for report/narrative generation.
 * Prefers `supabase.functions.invoke('anthropic-proxy')` (same path as web), with retries for
 * transient Anthropic / edge connection failures. Falls back to fetch(proxy|direct) if invoke is unavailable.
 */
export async function invokeAnthropicMessages(
  payload: AnthropicMessagesPayload,
): Promise<AnthropicMessagesResponse> {
  return withRetry(
    async () => {
      try {
        return await invokeAnthropicViaEdge(payload);
      } catch (edgeErr) {
        // If the client has no session / functions client issue, try raw fetch to the configured endpoint.
        const msg = edgeErr instanceof Error ? edgeErr.message : String(edgeErr);
        const canFallbackToFetch =
          /functions\.invoke|Failed to send|Network request failed|fetch failed/i.test(msg) &&
          !/ANTHROPIC_API_KEY|Invalid Anthropic|not set/i.test(msg);
        if (!canFallbackToFetch) throw edgeErr;
        console.warn('[Anthropic] edge invoke unavailable, falling back to fetch:', msg.slice(0, 120));
        return invokeAnthropicViaFetch(payload);
      }
    },
    {
      retries: 3,
      baseDelay: 1500,
      maxDelay: 8000,
      context: 'Anthropic report narrative',
    },
  );
}
