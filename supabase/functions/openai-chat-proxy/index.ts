const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const OPENAI_PROXY_TIMEOUT_MS = 180_000;

/** Strip accidental quotes/newlines from dashboard or PowerShell `secrets set` pastes. */
function normalizeOpenAiApiKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key.length > 0 ? key : undefined;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = normalizeOpenAiApiKey(Deno.env.get('OPENAI_API_KEY'));
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: {
          message:
            'OPENAI_API_KEY not set in Supabase. Project Settings → Edge Functions → Secrets → add OPENAI_API_KEY.',
        },
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: { message: 'Invalid or missing JSON body' } }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (
    body == null ||
    typeof body !== 'object' ||
    !Array.isArray((body as { messages?: unknown }).messages)
  ) {
    return new Response(
      JSON.stringify({ error: { message: 'Request body must be an object with a "messages" array' } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const payload = body as {
    model?: string;
    max_tokens?: number;
    temperature?: number;
    messages: Array<{ role: string; content: string }>;
  };

  try {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), OPENAI_PROXY_TIMEOUT_MS);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: payload.model ?? 'gpt-4o',
        max_tokens: payload.max_tokens ?? 4000,
        temperature: payload.temperature ?? 0.7,
        messages: payload.messages,
      }),
      signal: abort.signal,
    });
    const text = await res.text();
    clearTimeout(timeout);

    if (!res.ok) {
      return new Response(text, {
        status: res.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(text, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? 'OpenAI request timed out'
        : err instanceof Error
          ? err.message
          : 'OpenAI proxy error';
    return new Response(JSON.stringify({ error: { message } }), {
      status: 504,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
