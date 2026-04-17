const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function formFieldString(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (v == null) return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    return t !== '' ? t : undefined;
  }
  if (v instanceof File) return undefined;
  const s = String(v).trim();
  return s !== '' ? s : undefined;
}

/** Merge `language` from multipart fields, alternate keys, and query string — forward a single value to OpenAI. */
function resolveIncomingLanguage(incoming: FormData, req: Request): string | undefined {
  const url = new URL(req.url);
  const fromQuery =
    url.searchParams.get('language')?.trim() ||
    url.searchParams.get('language_parameter')?.trim() ||
    url.searchParams.get('lang')?.trim();
  if (fromQuery) return fromQuery;
  for (const key of ['language', 'language_parameter', 'lang', 'locale'] as const) {
    const s = formFieldString(incoming, key);
    if (s) return s;
  }
  for (const [k, v] of incoming.entries()) {
    if (typeof v !== 'string' || v.trim() === '') continue;
    const kl = k.toLowerCase();
    if (kl === 'language' || kl === 'language_parameter' || kl === 'lang' || kl === 'locale') {
      return v.trim();
    }
  }
  return undefined;
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

  const apiKey = Deno.env.get('OPENAI_API_KEY')?.trim();
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: 'OPENAI_API_KEY not set in Supabase secrets' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const incoming = await req.formData();
    const file = incoming.get('file');
    if (!(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: { message: 'Missing audio file in form field "file"' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const model = (incoming.get('model')?.toString() || 'whisper-1').trim();
    const outgoing = new FormData();
    outgoing.set('model', model);
    outgoing.set('file', file, file.name || 'recording.m4a');
    const responseFormat = incoming.get('response_format')?.toString();
    if (responseFormat) outgoing.set('response_format', responseFormat);
    const language = resolveIncomingLanguage(incoming, req);
    if (language) outgoing.set('language', language);
    const temperature = incoming.get('temperature')?.toString();
    if (temperature !== undefined && temperature !== '') outgoing.set('temperature', temperature);

    const openAiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: outgoing,
    });

    const text = await openAiRes.text();
    return new Response(text, {
      status: openAiRes.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: String(err) } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
