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

  const apiKey = Deno.env.get('ELEVENLABS_API_KEY')?.trim();
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: { message: 'ELEVENLABS_API_KEY not set in Supabase secrets' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const payload = await req.json() as {
      text?: string;
      voiceId?: string;
      modelId?: string;
      voiceSettings?: {
        stability?: number;
        similarity_boost?: number;
        style?: number;
        use_speaker_boost?: boolean;
      };
    };

    const text = (payload.text ?? '').trim();
    const voiceId = (payload.voiceId ?? '').trim();
    if (!text || !voiceId) {
      return new Response(
        JSON.stringify({ error: { message: 'text and voiceId are required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: payload.modelId ?? 'eleven_multilingual_v2',
        voice_settings: payload.voiceSettings ?? {
          stability: 0.22,
          similarity_boost: 0.82,
          style: 0.65,
          use_speaker_boost: true,
        },
      }),
    });

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      return new Response(errText, {
        status: elevenRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(elevenRes.body, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: String(err) } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
