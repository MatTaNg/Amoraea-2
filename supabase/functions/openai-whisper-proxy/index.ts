const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

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
