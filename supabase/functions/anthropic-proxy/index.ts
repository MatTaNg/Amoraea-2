import {
  DEFAULT_CLAUDE_SONNET_MODEL,
  resolveAnthropicSonnetModel,
} from '../_shared/resolveAnthropicSonnetModel.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const ANTHROPIC_PROXY_TIMEOUT_MS = 180_000;

Deno.serve(async (req) => {
  // Preflight: must return 204 and CORS headers so browser allows the actual POST
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rawKey = Deno.env.get('ANTHROPIC_API_KEY');
  const apiKey = rawKey?.trim();
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY not set in Supabase. Project Settings → Edge Functions → Secrets → add ANTHROPIC_API_KEY with your key from console.anthropic.com' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: { message: 'Invalid or missing JSON body' } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (body == null || typeof body !== 'object' || !Array.isArray((body as { messages?: unknown }).messages)) {
    return new Response(
      JSON.stringify({ error: { message: 'Request body must be an object with a "messages" array' } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const payload = body as Record<string, unknown>;
  const requestedModel = typeof payload.model === 'string' ? payload.model : '';
  const resolvedModel = resolveAnthropicSonnetModel(requestedModel);
  if (resolvedModel !== requestedModel) {
    console.warn(
      `[anthropic-proxy] remapped retired model "${requestedModel}" -> "${resolvedModel}"`
    );
    payload.model = resolvedModel;
  } else if (!requestedModel) {
    payload.model = DEFAULT_CLAUDE_SONNET_MODEL;
  }

  const maxAttempts = 3;
  let lastTransportError: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), ANTHROPIC_PROXY_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(payload),
          signal: abort.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      const text = await res.text();
      if (res.status === 401) {
        return new Response(
          JSON.stringify({
            error: {
              message:
                'Invalid Anthropic API key. In Supabase: Project Settings → Edge Functions → Secrets, set ANTHROPIC_API_KEY to your key from console.anthropic.com (starts with sk-ant-). No quotes or extra spaces.',
            },
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      // Retry Anthropic transient overload / upstream blips from the edge.
      if ((res.status === 529 || res.status === 503 || res.status === 502) && attempt < maxAttempts) {
        console.warn(
          `[anthropic-proxy] Anthropic HTTP ${res.status} on attempt ${attempt}/${maxAttempts}; retrying`,
        );
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      // Forward response (including 400) so client sees Anthropic's error message
      return new Response(text, {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? `Anthropic proxy timed out after ${Math.round(ANTHROPIC_PROXY_TIMEOUT_MS / 1000)}s`
          : String(err);
      lastTransportError = message;
      const retryable =
        /connection reset|connection error|error sending request|SendRequest|temporarily|network/i.test(
          message,
        ) && !(err instanceof Error && err.name === 'AbortError');
      if (retryable && attempt < maxAttempts) {
        console.warn(
          `[anthropic-proxy] transport error on attempt ${attempt}/${maxAttempts}; retrying:`,
          message.slice(0, 160),
        );
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
      return new Response(JSON.stringify({ error: { message } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(
    JSON.stringify({
      error: {
        message: lastTransportError ?? 'Anthropic proxy failed after retries',
      },
    }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});