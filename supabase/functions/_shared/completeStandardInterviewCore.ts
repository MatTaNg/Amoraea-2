/**
 * Server-side completion for standard onboarding: holistic score + gate + AI reasoning, then DB updates.
 * Invoked from complete-standard-interview (user JWT) or process-deferred-standard-interviews (cron).
 */
import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildScoringPrompt } from './holisticScoringPrompt.ts';
import {
  computeGateResultCore,
  GATE_PASS_WEIGHTED_MIN,
  REFERRAL_WEIGHTED_PASS_MIN,
} from './computeGateResultCore.ts';
import { generateAIReasoning } from './generateAIReasoning.ts';

/**
 * Must leave headroom for AI reasoning + DB + cold start under Supabase Edge wall clock (~150s free/pro).
 * Previously 180s holistic alone could exceed the platform limit → gateway 504 / browser “pending” until timeout.
 */
const HOLISTIC_FETCH_TIMEOUT_MS = 65_000;

type Transcript = Array<{ role: string; content?: string }>;

type InterviewResults = {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
  interviewSummary?: string;
  notableInconsistencies?: string[];
  skepticismModifier?: { pillarId: number | string | null; adjustment: number; reason?: string } | null;
};

function getAnthropicEndpoint(): string {
  const proxy = Deno.env.get('ANTHROPIC_PROXY_URL') ?? '';
  return proxy && proxy.length > 0 ? proxy : 'https://api.anthropic.com/v1/messages';
}

function scenarioScoresFromAttempt(
  s1: unknown,
  s2: unknown,
  s3: unknown
): Record<number, { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined> {
  const out: Record<
    number,
    { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined
  > = {};
  ([1, 2, 3] as const).forEach((n) => {
    const raw = n === 1 ? s1 : n === 2 ? s2 : s3;
    if (!raw || typeof raw !== 'object') return;
    const o = raw as { pillarScores?: Record<string, number | null>; scenarioName?: string };
    const ps = o.pillarScores;
    if (!ps || typeof ps !== 'object') return;
    out[n] = { pillarScores: ps, scenarioName: o.scenarioName };
  });
  return out;
}

function toNumericPillarMap(scores: Record<string, number | null | undefined> | undefined | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!scores) return out;
  for (const [k, v] of Object.entries(scores)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** Balanced `{ ... }` from a known `{` index (handles strings and escapes). */
function extractBalancedJsonObjectFrom(s: string, start: number): string | null {
  if (s[start] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Prose before JSON ("Looking at…") or multiple `{` regions (embedded snippets). Try whole string,
 * then each balanced `{...}` from left to right until one parses.
 */
function parseHolisticJsonFromModelText(raw: string): { ok: true; parsed: InterviewResults } | { ok: false; error: string } {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  try {
    return { ok: true, parsed: JSON.parse(cleaned) as InterviewResults };
  } catch {
    /* fall through */
  }
  let searchFrom = 0;
  let lastErr = 'no JSON object found in model output (expected { … })';
  const maxTries = 100;
  for (let t = 0; t < maxTries; t++) {
    const start = cleaned.indexOf('{', searchFrom);
    if (start < 0) break;
    const extracted = extractBalancedJsonObjectFrom(cleaned, start);
    if (!extracted) {
      searchFrom = start + 1;
      continue;
    }
    try {
      return { ok: true, parsed: JSON.parse(extracted) as InterviewResults };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      searchFrom = start + 1;
    }
  }
  return { ok: false, error: lastErr };
}

export type CompleteStandardInterviewResult =
  | { ok: true; attemptId: string; skipped?: string }
  | { ok: false; error: string };

/**
 * @param supabase -- service-role client
 * @param userId -- must match row.user_id (already verified by caller)
 */
export async function runCompleteStandardInterview(
  supabase: SupabaseClient,
  attemptId: string,
  userId: string
): Promise<CompleteStandardInterviewResult> {
  const { data: row, error: qErr } = await supabase
    .from('interview_attempts')
    .select(
      'id, user_id, scoring_deferred, transcript, interview_typology_context, scenario_1_scores, scenario_2_scores, scenario_3_scores, response_timings, probe_log'
    )
    .eq('id', attemptId)
    .maybeSingle();

  if (qErr || !row) {
    return { ok: false, error: qErr?.message ?? 'attempt not found' };
  }
  if (row.user_id !== userId) {
    return { ok: false, error: 'attempt user mismatch' };
  }
  if (row.scoring_deferred !== true) {
    return { ok: true, attemptId, skipped: 'not_deferred' };
  }

  const transcript = (row.transcript as Transcript | null) ?? [];
  if (transcript.length === 0) {
    return { ok: false, error: 'empty transcript' };
  }

  try {
    await supabase.rpc('fulfill_referral_after_interview', { p_user_id: userId });
  } catch {
    /* best-effort */
  }

  // Two separate `users` reads must use distinct binding names (Deno rejects duplicate `userRow` in one scope).
  const { data: userWeights } = await supabase
    .from('users')
    .select('referral_boost_active')
    .eq('id', userId)
    .maybeSingle();
  const weightedMin =
    userWeights?.referral_boost_active === true ? REFERRAL_WEIGHTED_PASS_MIN : GATE_PASS_WEIGHTED_MIN;

  const typology = (row as { interview_typology_context?: string | null }).interview_typology_context ?? '';
  const userPrompt = buildScoringPrompt(
    transcript.map((m) => ({ role: m.role, content: m.content ?? '' })),
    typology || 'No typology context — score from transcript only.'
  );

  const apiUrl = getAnthropicEndpoint();
  const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
  if (useProxy) {
    if (!(Deno.env.get('SUPABASE_ANON_KEY') ?? '').trim()) {
      return {
        ok: false,
        error:
          'Set SUPABASE_ANON_KEY in Edge Function secrets (needed when ANTHROPIC_PROXY_URL is set) or set ANTHROPIC_API_KEY for direct Anthropic',
      };
    }
  } else {
    if (!(Deno.env.get('ANTHROPIC_API_KEY') ?? '').trim()) {
      return {
        ok: false,
        error:
          'ANTHROPIC_API_KEY is not set in this project (Edge Function secrets) — add it, or set ANTHROPIC_PROXY_URL to the anthropic-proxy function URL',
      };
    }
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useProxy) {
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (anon) headers['Authorization'] = `Bearer ${anon}`;
  } else {
    const key = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
  }

  const abort = new AbortController();
  const t = setTimeout(() => abort.abort(), HOLISTIC_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      signal: abort.signal,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
  } finally {
    clearTimeout(t);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: `holistic: HTTP ${res.status} (non-JSON error body from API)` };
  }
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    return { ok: false, error: `holistic: ${msg}` };
  }
  const raw = (data as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? '{}';
  const holisticParse = parseHolisticJsonFromModelText(raw);
  if (!holisticParse.ok) {
    return { ok: false, error: `parse holistic: ${holisticParse.error}` };
  }
  const parsed = holisticParse.parsed;

  const gate = computeGateResultCore(parsed.pillarScores ?? {}, parsed.skepticismModifier ?? null, {
    weightedPassMin: weightedMin,
  });

  const scenarioMap = scenarioScoresFromAttempt(
    row.scenario_1_scores,
    row.scenario_2_scores,
    row.scenario_3_scores
  );
  const pillarForReasoning = toNumericPillarMap(parsed.pillarScores as Record<string, number | null>);

  let reasoning: Awaited<ReturnType<typeof generateAIReasoning>> & { _reasoningPending?: boolean };
  try {
    reasoning = (await generateAIReasoning(
      pillarForReasoning,
      scenarioMap,
      transcript,
      gate.weightedScore,
      gate.pass,
      [],
      null,
      { perAttemptTimeoutMs: 40_000, maxAttempts: 2 }
    )) as unknown as typeof reasoning;
  } catch (e) {
    reasoning = {
      _reasoningPending: true,
      overall_strengths: [],
      overall_growth_areas: [],
    } as typeof reasoning;
  }
  const reasoningPending = !!(reasoning as { _reasoningPending?: boolean })._reasoningPending;
  const aiReasoningOut = reasoningPending
    ? {
        _reasoningPending: true,
        pillar_scores: pillarForReasoning,
        weighted_score: gate.weightedScore,
        passed: gate.pass,
        note: 'Narrative AI reasoning failed or timed out; scores saved.',
      }
    : reasoning;

  const { error: upA } = await supabase
    .from('interview_attempts')
    .update({
      completed_at: new Date().toISOString(),
      weighted_score: gate.weightedScore,
      passed: gate.pass,
      gate_fail_reason: gate.failReason,
      pillar_scores: parsed.pillarScores ?? null,
      ai_reasoning: aiReasoningOut,
      reasoning_pending: reasoningPending,
      scoring_deferred: false,
      response_timings: row.response_timings,
      probe_log: row.probe_log,
    })
    .eq('id', attemptId)
    .eq('user_id', userId);

  if (upA) {
    return { ok: false, error: upA.message };
  }

  const { data: userOverride } = await supabase
    .from('users')
    .select('interview_passed_admin_override')
    .eq('id', userId)
    .maybeSingle();
  const o = (userOverride as { interview_passed_admin_override?: boolean | null } | null)
    ?.interview_passed_admin_override;
  const effectivePass = o === true || o === false ? o : gate.pass;

  const { error: upU } = await supabase
    .from('users')
    .update({
      interview_completed: true,
      interview_passed_computed: gate.pass,
      interview_passed: effectivePass,
      interview_weighted_score: gate.weightedScore,
      interview_pillar_scores: parsed.pillarScores ?? null,
    })
    .eq('id', userId);

  if (upU) {
    return { ok: false, error: upU.message };
  }

  const baseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (baseUrl && (serviceKey || anonKey)) {
    void fetch(`${baseUrl}/functions/v1/analyze-interview-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey || anonKey}`,
        apikey: anonKey || serviceKey,
      },
      body: JSON.stringify({ user_id: userId, attempt_id: attemptId }),
    }).catch(() => {});
  }

  return { ok: true, attemptId };
}
