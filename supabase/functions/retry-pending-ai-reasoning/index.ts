/**
 * Cron-invokable: processes interview_attempts with reasoning_pending = true.
 * Set secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
 * ANTHROPIC_API_KEY (direct Claude) OR ANTHROPIC_PROXY_URL + SUPABASE_ANON_KEY (via anthropic-proxy).
 *
 * Schedule: Supabase Dashboard → Edge Functions → invoke on a schedule, or pg_cron + pg_net,
 * or an external cron hitting POST with Authorization: Bearer <CRON_SECRET>.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { processNarrativeForAttempt } from '../_shared/processNarrativeForAttempt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function authorized(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET') ?? '';
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (bearer === secret) return true;
  const hdr = req.headers.get('x-cron-secret');
  return hdr === secret;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!authorized(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('[narrative] retry-pending-ai-reasoning worker started');

  const supabase = createClient(url, serviceKey);
  const { data: rows, error: qErr } = await supabase
    .from('interview_attempts')
    .select('id')
    .eq('reasoning_pending', true)
    .order('completed_at', { ascending: true })
    .limit(5);

  if (qErr) {
    console.error('[narrative] retry-pending-ai-reasoning query failed:', qErr.message);
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: { id: string; ok: boolean; error?: string; skipped?: boolean }[] = [];

  for (const raw of rows ?? []) {
    const id = (raw as { id: string }).id;
    const out = await processNarrativeForAttempt(supabase, id, {
      source: 'retry-pending-ai-reasoning',
    });
    results.push({
      id,
      ok: out.ok,
      error: out.error,
      skipped: out.skipped,
    });
  }

  console.log('[narrative] retry-pending-ai-reasoning worker finished', {
    processed: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });

  return new Response(JSON.stringify({ processed: results.length, results }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
