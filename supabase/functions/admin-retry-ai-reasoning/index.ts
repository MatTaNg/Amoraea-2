import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateAIReasoning, DEFAULT_AI_REASONING_PER_ATTEMPT_TIMEOUT_MS } from '../_shared/generateAIReasoning.ts';
import { buildReasoningFailurePatch } from '../_shared/aiReasoningPostProcess.ts';
import { rollupPillarScoresFromStoredAttemptRow } from '../_shared/resolvePillarScoresForNarrative.ts';

const ADMIN_EMAIL = 'admin@amoraea.com';
const ADMIN_AI_REASONING_BACKGROUND_TIMEOUT_MS = 300_000;
const HANDLER_VERSION = 'admin-retry-ai-reasoning-queued-v2';

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
  return new Response(JSON.stringify({ handlerVersion: HANDLER_VERSION, ...body }), {
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

function pillarScoresRecord(raw: Record<string, number> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

function pendingReasoningWithError(existing: Record<string, unknown> | null, error: string): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    _reasoningPending: false,
    _narrativeFailed: true,
    _generationFailed: true,
    last_error: error,
    failed_at: new Date().toISOString(),
  };
}

async function runReasoningRetryInBackground(
  admin: ReturnType<typeof createClient>,
  attemptId: string,
  _attemptSnapshot: AttemptRow
): Promise<void> {
  const startedAt = Date.now();
  console.log(`[narrative] Starting for attempt ${attemptId} (source=admin-retry-ai-reasoning)`);
  const { data: freshRow, error: refetchErr } = await admin
    .from('interview_attempts')
    .select(
      'id, pillar_scores, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_specific_patterns, transcript, weighted_score, passed, ai_reasoning, ego_development_level'
    )
    .eq('id', attemptId)
    .maybeSingle();
  if (refetchErr || !freshRow) {
    const error = refetchErr?.message ?? 'attempt_not_found_on_background_refetch';
    await admin
      .from('interview_attempts')
      .update({
        ai_reasoning: pendingReasoningWithError(_attemptSnapshot.ai_reasoning, error),
        reasoning_pending: false,
      })
      .eq('id', attemptId);
    return;
  }

  const attempt = freshRow as AttemptRow;
  let pillarScores = pillarScoresRecord(attempt.pillar_scores);
  if (Object.keys(pillarScores).length === 0) {
    const rolledUp = rollupPillarScoresFromStoredAttemptRow(attempt);
    if (rolledUp) {
      pillarScores = rolledUp;
      await admin
        .from('interview_attempts')
        .update({ pillar_scores: rolledUp })
        .eq('id', attemptId);
    }
  }

  if (Object.keys(pillarScores).length === 0) {
    const error = 'missing_pillar_scores';
    await admin
      .from('interview_attempts')
      .update({
        ai_reasoning: pendingReasoningWithError(attempt.ai_reasoning, error),
        reasoning_pending: false,
      })
      .eq('id', attemptId);
    return;
  }

  try {
    console.log(`[narrative] Attempt ${attemptId} fetched, calling model`);
    const reasoning = await generateAIReasoning(
      pillarScores,
      scenarioScoresFromAttempt(attempt),
      attempt.transcript ?? [],
      attempt.weighted_score,
      attempt.passed === true,
      [],
      { perAttemptTimeoutMs: ADMIN_AI_REASONING_BACKGROUND_TIMEOUT_MS, maxAttempts: 1 }
    );
    console.log(`[narrative] Model returned response, writing to DB for attempt ${attemptId}`);
    await admin
      .from('interview_attempts')
      .update({
        ai_reasoning: {
          ...(reasoning as unknown as Record<string, unknown>),
          _adminRetryElapsedMs: Date.now() - startedAt,
          _adminRetryCompletedAt: new Date().toISOString(),
        },
        reasoning_pending: false,
      })
      .eq('id', attemptId);
    console.log(`[narrative] Completed successfully for attempt ${attemptId}`, {
      elapsed_ms: Date.now() - startedAt,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (error.includes('aborted') || (e instanceof Error && e.name === 'AbortError')) {
      console.error('[narrative] AbortError on admin retry:', error);
    }
    console.error(`[narrative] Unhandled error for attempt ${attemptId}:`, e);
    await admin
      .from('interview_attempts')
      .update({
        ai_reasoning: {
          ...buildReasoningFailurePatch(attempt.ai_reasoning, error, { generationFailed: true }),
          _adminRetryElapsedMs: Date.now() - startedAt,
        },
        reasoning_pending: false,
      })
      .eq('id', attemptId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method === 'GET') {
    return json({ ok: true, health: true, stage: 'healthcheck' });
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
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
    if (fetchErr) return json({ error: fetchErr.message, stage: 'attempt_fetch_failed' }, 500);
    if (!row) return json({ error: 'Attempt not found', stage: 'attempt_not_found' }, 404);

    const attempt = row as AttemptRow;
    const { error: queuedUpdateErr } = await admin
      .from('interview_attempts')
      .update({
        ai_reasoning: {
          ...(attempt.ai_reasoning ?? {}),
          _reasoningPending: true,
          _adminRetryQueued: true,
          _adminRetryQueuedAt: new Date().toISOString(),
          _adminRetryHandlerVersion: HANDLER_VERSION,
          _adminRetryStage: 'queued_before_background_handoff',
          last_error: null,
        },
        reasoning_pending: true,
      })
      .eq('id', attemptId);
    if (queuedUpdateErr) return json({ error: queuedUpdateErr.message, stage: 'queue_marker_update_failed' }, 500);

    try {
      EdgeRuntime.waitUntil(Promise.resolve().then(() => runReasoningRetryInBackground(admin, attemptId, attempt)));
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await admin
        .from('interview_attempts')
        .update({
          ai_reasoning: {
            ...buildReasoningFailurePatch(attempt.ai_reasoning, error, { generationFailed: true }),
            _adminRetryHandlerVersion: HANDLER_VERSION,
            _adminRetryStage: 'wait_until_registration_failed',
          },
          reasoning_pending: false,
        })
        .eq('id', attemptId);
      return json({ error, stage: 'wait_until_registration_failed' }, 500);
    }
    return json({
      ok: true,
      queued: true,
      stage: 'queued',
      timeoutMs: ADMIN_AI_REASONING_BACKGROUND_TIMEOUT_MS,
      previousTimeoutMs: DEFAULT_AI_REASONING_PER_ATTEMPT_TIMEOUT_MS,
    });
  } catch (e) {
    return json(
      {
        error: e instanceof Error ? e.message : String(e),
        stage: 'top_level_catch',
      },
      500
    );
  }
});
