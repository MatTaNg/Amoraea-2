/**
 * Cron / scheduled: process interview_attempts with scoring_deferred = true (retries if client invoke failed or timed out).
 * Authorization: Bearer <CRON_SECRET> or x-cron-secret header (same pattern as retry-pending-ai-reasoning).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { runCompleteStandardInterview } from '../_shared/completeStandardInterviewCore.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function authorized(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET') ?? '';
  if (!secret) return false;
  const bearer = req.headers.get('authorization')?.startsWith('Bearer ')
    ? req.headers.get('authorization')!.slice(7)
    : null;
  if (bearer === secret) return true;
  return req.headers.get('x-cron-secret') === secret;
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
    return new Response(JSON.stringify({ error: 'Missing env' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(url, serviceKey);
  const { data: rows, error: qErr } = await supabase
    .from('interview_attempts')
    .select('id, user_id')
    .eq('scoring_deferred', true)
    .order('created_at', { ascending: true })
    .limit(5);

  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: { id: string; ok: boolean; error?: string; skipped?: string }[] = [];
  for (const r of rows ?? []) {
    const id = (r as { id: string; user_id: string }).id;
    const uid = (r as { id: string; user_id: string }).user_id;
    const out = await runCompleteStandardInterview(supabase, id, uid);
    if (out.ok) {
      results.push({ id, ok: true, skipped: out.skipped });
    } else {
      results.push({ id, ok: false, error: out.error });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
