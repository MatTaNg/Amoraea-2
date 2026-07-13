import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

console.log('[ProcessDoc] script loaded');

/** 
 * Inline model to avoid potential shared import issues during debugging.
 * Fallback to standard Claude 3.5 Sonnet if not overridden.
 */
const CLAUDE_SONNET_MODEL = Deno.env.get('ANTHROPIC_SONNET_MODEL')?.trim() || 'claude-sonnet-4-6';

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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        // PDF support is in beta as of late 2024/2025; adding header for compatibility if document block is used.
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    let json: any;
    const text = await res.text();
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Anthropic returned non-JSON response (${res.status}): ${text.slice(0, 100)}`);
    }

    if (!res.ok) {
      const msg =
        typeof json?.error?.message === 'string'
          ? json.error.message
          : `Anthropic request failed (${res.status}): ${text.slice(0, 100)}`;
      throw new Error(msg);
    }
    return json as { content?: Array<{ text?: string }> };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Anthropic API request timed out after 60 seconds');
    }
    throw error;
  }
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
    console.log('[ProcessDoc] starting download for:', fileName);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('personality-documents')
      .download(storagePath);

    if (downloadError || !fileData) {
      throw downloadError ?? new Error('Download failed');
    }
    console.log('[ProcessDoc] download complete, size:', fileData.size);

    let signalText = '';

    if (
      mediaType.startsWith('text/') ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.csv')
    ) {
      console.log('[ProcessDoc] processing as text file');
      const arrayBuffer = await fileData.arrayBuffer();
      const decoder = new TextDecoder('utf-8');
      const textContent = decoder.decode(arrayBuffer);
      console.log('[ProcessDoc] text decoded, length:', textContent.length);
      if (!textContent.trim()) throw new Error('No text content could be extracted');

      console.log('[ProcessDoc] calling Anthropic API for text analysis');
      const signalResult = await anthropicMessages(apiKey, {
        model: CLAUDE_SONNET_MODEL,
        max_tokens: 1500,
        system: SIGNAL_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Extract personality signals from this document:\n\n${textContent.slice(0, 8000)}`,
          },
        ],
      });
      console.log('[ProcessDoc] Anthropic API response received');
      signalText = signalResult.content?.[0]?.text ?? '';
      console.log('[ProcessDoc] signal text length:', signalText.length);
    } else if (mediaType === 'application/pdf') {
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = base64Encode(new Uint8Array(arrayBuffer));

      const signalResult = await anthropicMessages(apiKey, {
        model: CLAUDE_SONNET_MODEL,
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
                  media_type: 'application/pdf',
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
    } else if (
      mediaType.includes('word') ||
      mediaType.includes('officedocument') ||
      mediaType.includes('msword')
    ) {
      throw new Error(
        'Word documents are not yet supported for direct analysis. Please upload as PDF or copy-paste text into a .txt file.',
      );
    } else if (mediaType.startsWith('image/')) {
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = base64Encode(new Uint8Array(arrayBuffer));

      const signalResult = await anthropicMessages(apiKey, {
        model: CLAUDE_SONNET_MODEL,
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
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[ProcessDoc] failed:', fileName, message, stack);
    await setDocumentStatus(supabase, storagePath, userId, 'failed', {
      processing_error: message,
      processing_error_details: stack,
    });
  }
}

Deno.serve(async (req) => {
  console.log(`[ProcessDoc] request received: ${req.method} ${req.url}`);
  try {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();

    if (!supabaseUrl || !anonKey || !serviceKey) {
      const missing = [];
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (!anonKey) missing.push('SUPABASE_ANON_KEY');
      if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      
      console.error('[ProcessDoc] missing env vars:', missing);
      return new Response(
        JSON.stringify({
          error: 'Server misconfiguration',
          message: `Missing environment variables: ${missing.join(', ')}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'ANTHROPIC_API_KEY not configured',
          message: 'Please set the ANTHROPIC_API_KEY secret in your Supabase project settings.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    let body: ProcessParams;
    try {
      const text = await req.text();
      try {
        body = JSON.parse(text) as ProcessParams;
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON', text: text.slice(0, 100) }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Could not read body', details: String(e) }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userId, storagePath, fileName, fileType } = body;
    if (!userId || !storagePath || !fileName) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters', 
          received: { userId: !!userId, storagePath: !!storagePath, fileName: !!fileName } 
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify user authorization via the JWT
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Not authorized', details: userErr?.message }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (userData.user.id !== userId) {
      return new Response(JSON.stringify({ error: 'Forbidden', message: 'User ID mismatch' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase service client
    let supabase;
    try {
      supabase = createClient(supabaseUrl, serviceKey);
      console.log('[ProcessDoc] service client initialized');
    } catch (e) {
      console.error('[ProcessDoc] failed to init service client', e);
      return new Response(JSON.stringify({ error: 'Initialization error', details: String(e) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Run processing in the background
    try {
      const task = runProcessPersonalityDocument(supabase, apiKey, {
        userId,
        storagePath,
        fileName,
        fileType,
      }).catch((e) => {
        console.error('[ProcessDoc] background task error:', e);
      });

      // @ts-ignore: EdgeRuntime is available in Supabase environment
      if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
        console.log('[ProcessDoc] using EdgeRuntime.waitUntil');
        EdgeRuntime.waitUntil(task);
      } else {
        // Local or other runtime
        console.log('[ProcessDoc] EdgeRuntime.waitUntil not available, task running detached');
      }
    } catch (e) {
      console.error('[ProcessDoc] task start failed', e);
    }

    return new Response(JSON.stringify({ accepted: true }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (globalError) {
    const msg = globalError instanceof Error ? globalError.message : String(globalError);
    const stack = globalError instanceof Error ? globalError.stack : undefined;
    console.error('[ProcessDoc] global crash:', { msg, stack });
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: msg,
        stack: stack?.split('\n').slice(0, 3) // Give some hint where it crashed
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
