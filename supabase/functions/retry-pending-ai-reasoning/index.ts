/**
 * Cron-invokable: processes interview_attempts with reasoning_pending = true.
 * Set secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
 * ANTHROPIC_API_KEY (direct Claude) OR ANTHROPIC_PROXY_URL + SUPABASE_ANON_KEY (via anthropic-proxy).
 *
 * Schedule: Supabase Dashboard → Edge Functions → invoke on a schedule, or pg_cron + pg_net,
 * or an external cron hitting POST with Authorization: Bearer <CRON_SECRET>.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { generateAIReasoning } from '../_shared/generateAIReasoning.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

type AttemptRow = {
  id: string;
  pillar_scores: Record<string, number> | null;
  scenario_1_scores: Record<string, unknown> | null;
  scenario_2_scores: Record<string, unknown> | null;
  scenario_3_scores: Record<string, unknown> | null;
  transcript: Array<{ role: string; content?: string }> | null;
  weighted_score: number | null;
  passed: boolean | null;
};

function scenarioScoresFromAttempt(row: AttemptRow): Record<
  number,
  { pillarScores: Record<string, number>; scenarioName?: string } | undefined
> {
  const out: Record<number, { pillarScores: Record<string, number>; scenarioName?: string } | undefined> = {};
  ([1, 2, 3] as const).forEach((n) => {
    const raw = row[`scenario_${n}_scores` as keyof AttemptRow] as Record<string, unknown> | null | undefined;
    if (!raw || typeof raw !== 'object') return;
    const ps = (raw as { pillarScores?: Record<string, number>; scenarioName?: string }).pillarScores;
    if (!ps || typeof ps !== 'object') return;
    out[n] = {
      pillarScores: ps,
      scenarioName: (raw as { scenarioName?: string }).scenarioName,
    };
  });
  return out;
}

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

  const supabase = createClient(url, serviceKey);
  const { data: rows, error: qErr } = await supabase
    .from('interview_attempts')
    .select(
      'id, pillar_scores, scenario_1_scores, scenario_2_scores, scenario_3_scores, transcript, weighted_score, passed'
    )
    .eq('reasoning_pending', true)
    .order('completed_at', { ascending: true })
    .limit(5);

  if (qErr) {
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const raw of rows ?? []) {
    const row = raw as AttemptRow;
    const pillarScores = (row.pillar_scores ?? {}) as Record<string, number>;
    const transcript = (row.transcript ?? []) as Array<{ role: string; content?: string }>;
    const scenarioScores = scenarioScoresFromAttempt(row);

    try {
      const reasoning = await generateAIReasoning(
        pillarScores,
        scenarioScores,
        transcript,
        row.weighted_score,
        row.passed === true,
        [],
        null
      );
      const { error: upErr } = await supabase
        .from('interview_attempts')
        .update({
          ai_reasoning: reasoning as unknown as Record<string, unknown>,
          reasoning_pending: false,
        })
        .eq('id', row.id);
      if (upErr) {
        results.push({ id: row.id, ok: false, error: upErr.message });
      } else {
        results.push({ id: row.id, ok: true });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`retry-pending-ai-reasoning: attempt ${row.id} failed:`, msg);
      results.push({ id: row.id, ok: false, error: msg });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
