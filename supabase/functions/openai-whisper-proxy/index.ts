import {
  resolveIncomingWhisperLanguage,
} from '../_shared/whisperProxyLanguage.ts';
import { resolveWhisperTranscriptionModel } from '../_shared/whisperTranscriptionModel.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

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

    const { model, incomingModel, ignoredIncomingModel } = resolveWhisperTranscriptionModel(incoming);
    if (ignoredIncomingModel) {
      console.warn('[openai-whisper-proxy] ignoring non-whisper client model', {
        incomingModel,
        forcedModel: model,
      });
    }

    const outgoing = new FormData();
    outgoing.set('model', model);
    outgoing.set('file', file, file.name || 'recording.m4a');
    const responseFormat = incoming.get('response_format')?.toString();
    if (responseFormat) outgoing.set('response_format', responseFormat);
    const language = resolveIncomingWhisperLanguage(incoming, req.url);
    if (language) outgoing.set('language', language);
    const temperature = incoming.get('temperature')?.toString();
    if (temperature !== undefined && temperature !== '') outgoing.set('temperature', temperature);

    const openAiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: outgoing,
    });

    const text = await openAiRes.text();
    if (!openAiRes.ok) {
      console.error('[openai-whisper-proxy] openai_error', {
        status: openAiRes.status,
        incomingModel,
        forcedModel: model,
        ignoredIncomingModel,
        preview: text.slice(0, 240),
      });
      if (
        openAiRes.status === 404 &&
        /Invalid URL \(POST \/v1\/audio\/transcriptions\)/.test(text)
      ) {
        return new Response(
          JSON.stringify({
            error: {
              message:
                'Whisper proxy rejected upstream request: only whisper-1 is valid for /v1/audio/transcriptions. Check client form field "model" and redeploy openai-whisper-proxy.',
              type: 'invalid_request_error',
              param: 'model',
              code: 'whisper_invalid_model_upstream',
            },
            proxy: {
              forced_model: model,
              incoming_model: incomingModel,
              ignored_incoming_model: ignoredIncomingModel,
            },
          }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
    }
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
