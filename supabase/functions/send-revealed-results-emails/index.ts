/**
 * Cron / scheduled: send results-ready emails for attempts whose pass/fail has been revealed
 * (admin override or 48h+ since `completed_at`). Idempotent via `results_email_sent_at`.
 *
 * Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { POST_INTERVIEW_PROCESSING_MS } from '../_shared/postInterviewRevealGate.ts';
import { sendResultsEmailForAttemptIfRevealed } from '../_shared/sendResultsEmailForAttempt.ts';

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
  const revealCutoffIso = new Date(Date.now() - POST_INTERVIEW_PROCESSING_MS).toISOString();

  const { data: rows, error: qErr } = await supabase
    .from('interview_attempts')
    .select('id, user_id')
    .is('results_email_sent_at', null)
    .not('completed_at', 'is', null)
    .or(`override_status.not.is.null,completed_at.lte.${revealCutoffIso}`)
    .order('completed_at', { ascending: true })
    .limit(50);

  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: { id: string; sent: boolean; skipped?: string; error?: string }[] = [];
  for (const row of rows ?? []) {
    const attemptId = (row as { id: string }).id;
    const userId = (row as { user_id: string }).user_id;
    try {
      const sent = await sendResultsEmailForAttemptIfRevealed(supabase, attemptId, userId);
      results.push({ id: attemptId, sent, skipped: sent ? undefined : 'reveal_not_ready_or_already_sent' });
    } catch (e) {
      results.push({
        id: attemptId,
        sent: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return new Response(JSON.stringify({ checked: results.length, results }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
