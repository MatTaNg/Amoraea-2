import { Platform } from 'react-native';

import { supabase } from '@data/supabase/client';
import { formatEdgeFunctionInvokeFailure } from '@utilities/runCommunicationStylePipeline';
import { getAnthropicEndpoint, getAnthropicRequestHeaders } from '@utilities/anthropicMessagesClient';

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

/**
 * Calls Claude for report/narrative generation.
 * On web (production PWA), uses `supabase.functions.invoke('anthropic-proxy')` so auth and CORS
 * match other Edge Function calls. Local dev with EXPO_PUBLIC_ANTHROPIC_API_KEY may use direct fetch.
 */
export async function invokeAnthropicMessages(
  payload: AnthropicMessagesPayload,
): Promise<AnthropicMessagesResponse> {
  const preferEdgeInvoke = Platform.OS === 'web';

  if (preferEdgeInvoke) {
    const { data, error } = await supabase.functions.invoke<AnthropicMessagesResponse | { error?: string | { message?: string } }>(
      'anthropic-proxy',
      { body: payload },
    );
    if (error) {
      const detail = formatEdgeFunctionInvokeFailure('anthropic-proxy', { error, data });
      console.error('[Anthropic] edge invoke failed:', detail);
      throw new Error(detail || 'Report generation failed (anthropic-proxy)');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Report generation failed (empty anthropic-proxy response)');
    }
    const errField = (data as { error?: string | { message?: string } }).error;
    if (errField) {
      const msg = typeof errField === 'string' ? errField : errField.message ?? 'Anthropic proxy error';
      throw new Error(msg);
    }
    return data as AnthropicMessagesResponse;
  }

  const response = await fetch(getAnthropicEndpoint(), {
    method: 'POST',
    headers: getAnthropicRequestHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Anthropic] direct request failed:', errorText);
    throw new Error('Report generation failed');
  }

  return (await response.json()) as AnthropicMessagesResponse;
}
