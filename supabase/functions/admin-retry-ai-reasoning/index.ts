import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateAIReasoning, DEFAULT_AI_REASONING_PER_ATTEMPT_TIMEOUT_MS } from '../_shared/generateAIReasoning.ts';

const ADMIN_EMAIL = 'admin@amoraea.com';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
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
  ai_reasoning: Record<string, unknown> | null;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function scenarioScoresFromAttempt(row: AttemptRow): Record<
  number,
  { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined
> {
  const out: Record<number, { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined> = {};
  ([1, 2, 3] as const).forEach((n) => {
    const raw = row[`scenario_${n}_scores` as keyof AttemptRow] as Record<string, unknown> | null | undefined;
    if (!raw || typeof raw !== 'object') return;
    const ps = (raw as { pillarScores?: Record<string, number | null>; scenarioName?: string }).pillarScores;
    if (!ps || typeof ps !== 'object') return;
    out[n] = {
      pillarScores: ps,
      scenarioName: (raw as { scenarioName?: string }).scenarioName,
    };
  });
  return out;
}

function pendingReasoningWithError(existing: Record<string, unknown> | null, error: string): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    _reasoningPending: true,
    _generationFailed: true,
    last_error: error,
    failed_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  if (!supabaseUrl || !serviceRole || !anonKey) return json({ error: 'Server misconfiguration' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: caller },
    error: callerErr,
  } = await userClient.auth.getUser();
  if (callerErr || caller?.email?.toLowerCase() !== ADMIN_EMAIL) {
    return json({ error: callerErr ? 'Unauthorized' : 'Forbidden' }, callerErr ? 401 : 403);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const attemptId =
    typeof body === 'object' && body !== null && typeof (body as { attemptId?: unknown }).attemptId === 'string'
      ? (body as { attemptId: string }).attemptId.trim()
      : '';
  if (!attemptId) return json({ error: 'Missing attemptId' }, 400);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: row, error: fetchErr } = await admin
    .from('interview_attempts')
    .select(
      'id, pillar_scores, scenario_1_scores, scenario_2_scores, scenario_3_scores, transcript, weighted_score, passed, ai_reasoning'
    )
    .eq('id', attemptId)
    .maybeSingle();
  if (fetchErr) return json({ error: fetchErr.message }, 500);
  if (!row) return json({ error: 'Attempt not found' }, 404);

  const attempt = row as AttemptRow;
  try {
    const reasoning = await generateAIReasoning(
      attempt.pillar_scores ?? {},
      scenarioScoresFromAttempt(attempt),
      attempt.transcript ?? [],
      attempt.weighted_score,
      attempt.passed === true,
      [],
      { perAttemptTimeoutMs: DEFAULT_AI_REASONING_PER_ATTEMPT_TIMEOUT_MS, maxAttempts: 1 }
    );
    const { error: upErr } = await admin
      .from('interview_attempts')
      .update({
        ai_reasoning: reasoning as unknown as Record<string, unknown>,
        reasoning_pending: false,
      })
      .eq('id', attemptId);
    if (upErr) return json({ error: upErr.message }, 500);
    return json({ ok: true });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await admin
      .from('interview_attempts')
      .update({
        ai_reasoning: pendingReasoningWithError(attempt.ai_reasoning, error),
        reasoning_pending: true,
      })
      .eq('id', attemptId);
    return json({ error }, 500);
  }
});
