import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, prefer, x-supabase-api-version, baggage, sentry-trace',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const SIGNAL_SYSTEM = `You extract personality and relational signals from user-submitted documents for a relationship platform.
Extract signals that reveal who this person is — their communication style, values in action, relational patterns, emotional vocabulary, how they talk about others, what they find meaningful.
Do NOT reproduce personally identifiable information about third parties.
Return ONLY a JSON object with these fields:
{
  "communication_style": string (direct/indirect/analytical/emotional/mixed),
  "emotional_vocabulary_richness": "low"|"moderate"|"high",
  "self_awareness_indicators": string[],
  "values_in_action": string[],
  "relational_patterns": string[],
  "humor_register": string or null,
  "topics_of_passion": string[],
  "narrative_summary": string (2-3 sentences describing this person as revealed by the document)
}`;

type ProcessParams = {
  userId: string;
  storagePath: string;
  fileName: string;
  fileType?: string;
};

async function anthropicMessages(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{ content?: Array<{ text?: string }> }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg =
      typeof json?.error?.message === 'string'
        ? json.error.message
        : `Anthropic request failed (${res.status})`;
    throw new Error(msg);
  }
  return json as { content?: Array<{ text?: string }> };
}

function inferMediaType(fileType: string | undefined, fileName: string): string {
  if (fileType && fileType.includes('/')) return fileType;
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.txt')) return 'text/plain';
  return fileType ?? 'application/octet-stream';
}

function parseSignalsFromModelText(rawText: string): {
  signals: Record<string, unknown>;
  narrativeSummary: string;
} {
  let signals: Record<string, unknown> = {};
  let narrativeSummary = '';
  try {
    const raw = rawText.replace(/```json|```/g, '').trim() || '{}';
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    narrativeSummary = typeof parsed.narrative_summary === 'string' ? parsed.narrative_summary : '';
    delete parsed.narrative_summary;
    signals = parsed;
  } catch (e) {
    console.warn('[ProcessDoc] signal parse failed:', e);
  }
  return { signals, narrativeSummary };
}

async function setDocumentStatus(
  supabase: SupabaseClient,
  storagePath: string,
  userId: string,
  processing_status: 'processing' | 'complete' | 'failed' | 'pending',
  extra?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('user_personality_documents')
    .update({ processing_status, ...extra })
    .eq('storage_path', storagePath)
    .eq('user_id', userId);
  if (error) {
    console.error('[ProcessDoc] status update failed:', processing_status, error.message);
  }
}

/** Runs outside the HTTP response so long PDF/Claude work is not cut off by the gateway timeout. */
async function runProcessPersonalityDocument(
  supabase: SupabaseClient,
  apiKey: string,
  params: ProcessParams,
): Promise<void> {
  const { userId, storagePath, fileName, fileType } = params;
  const mediaType = inferMediaType(fileType, fileName);

  await setDocumentStatus(supabase, storagePath, userId, 'processing');

  try {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('personality-documents')
      .download(storagePath);

    if (downloadError || !fileData) {
      throw downloadError ?? new Error('Download failed');
    }

    let signalText = '';

    if (
      mediaType.startsWith('text/') ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.csv')
    ) {
      const textContent = await fileData.text();
      if (!textContent.trim()) throw new Error('No text content could be extracted');

      const signalResult = await anthropicMessages(apiKey, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: SIGNAL_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Extract personality signals from this document:\n\n${textContent.slice(0, 8000)}`,
          },
        ],
      });
      signalText = signalResult.content?.[0]?.text ?? '';
    } else if (
      mediaType.includes('pdf') ||
      mediaType.includes('word') ||
      mediaType.includes('document')
    ) {
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = base64Encode(new Uint8Array(arrayBuffer));

      const signalResult = await anthropicMessages(apiKey, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: SIGNAL_SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: 'Extract personality signals from this document per the system instructions. Return JSON only.',
              },
            ],
          },
        ],
      });
      signalText = signalResult.content?.[0]?.text ?? '';
    } else if (mediaType.startsWith('image/')) {
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = base64Encode(new Uint8Array(arrayBuffer));

      const signalResult = await anthropicMessages(apiKey, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: SIGNAL_SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              {
                type: 'text',
                text: 'Extract personality signals from any text visible in this image. Return JSON only.',
              },
            ],
          },
        ],
      });
      signalText = signalResult.content?.[0]?.text ?? '';
    } else {
      throw new Error(`Unsupported file type: ${mediaType}`);
    }

    if (!signalText.trim()) {
      throw new Error('No analysis returned from model');
    }

    const { signals, narrativeSummary } = parseSignalsFromModelText(signalText);

    await setDocumentStatus(supabase, storagePath, userId, 'complete', {
      extracted_signals: signals,
      narrative_summary: narrativeSummary,
      processed_at: new Date().toISOString(),
    });

    await supabase
      .from('users')
      .update({ personality_documents_uploaded_at: new Date().toISOString() })
      .eq('id', userId);

    console.log('[ProcessDoc] complete for:', fileName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[ProcessDoc] failed:', fileName, message);
    await setDocumentStatus(supabase, storagePath, userId, 'failed');
  }
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

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim() ?? '';

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: ProcessParams;
  try {
    body = (await req.json()) as ProcessParams;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { userId, storagePath, fileName, fileType } = body;
  if (!userId || !storagePath || !fileName) {
    return new Response(JSON.stringify({ error: 'userId, storagePath, and fileName required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
  const callerId = userData.user?.id;
  if (userErr || !callerId || callerId !== userId) {
    return new Response(JSON.stringify({ error: 'Not authorized' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    EdgeRuntime.waitUntil(
      runProcessPersonalityDocument(supabase, apiKey, { userId, storagePath, fileName, fileType }).catch(
        (e) => {
          console.error('[ProcessDoc] background task error:', e);
        },
      ),
    );
  } catch (e) {
    console.error('[ProcessDoc] EdgeRuntime.waitUntil failed', e);
    await runProcessPersonalityDocument(supabase, apiKey, { userId, storagePath, fileName, fileType });
  }

  return new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
