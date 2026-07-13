/**
 * Shared narrative queue processor for edge workers (cron retry, admin retry, background jobs).
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildReasoningFailurePatch } from './aiReasoningPostProcess.ts';
import { generateAIReasoning } from './generateAIReasoning.ts';
import { buildEvidenceContextFromAttemptPatterns } from './narrativeEvidenceGuidance.ts';
import { rollupPillarScoresFromStoredAttemptRow } from './resolvePillarScoresForNarrative.ts';

/** Matches admin-retry / complete-standard-interview background budget. */
export const NARRATIVE_BACKGROUND_TIMEOUT_MS = 300_000;

export type NarrativeAttemptRow = {
  id: string;
  user_id?: string;
  pillar_scores: Record<string, number> | null;
  scenario_1_scores: Record<string, unknown> | null;
  scenario_2_scores: Record<string, unknown> | null;
  scenario_3_scores: Record<string, unknown> | null;
  scenario_specific_patterns?: Record<string, unknown> | null;
  transcript: Array<{ role: string; content?: string }> | null;
  weighted_score: number | null;
  passed: boolean | null;
  ai_reasoning: Record<string, unknown> | null;
  reasoning_pending?: boolean | null;
};

export function interviewAiReasoningIsSubstantive(
  ar: Record<string, unknown> | null | undefined,
): boolean {
  if (!ar || typeof ar !== 'object') return false;
  const overall = ar.overall_summary;
  if (typeof overall === 'string' && overall.trim().length > 0) return true;
  const interview = ar.interview_summary;
  if (typeof interview === 'string' && interview.trim().length > 0) return true;
  const strengths = ar.overall_strengths;
  if (Array.isArray(strengths) && strengths.some((x) => typeof x === 'string' && x.trim().length > 0)) {
    return true;
  }
  const growth = ar.overall_growth_areas;
  if (Array.isArray(growth) && growth.some((x) => typeof x === 'string' && x.trim().length > 0)) {
    return true;
  }
  return false;
}

function pillarScoresRecord(raw: Record<string, number> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

export function scenarioScoresFromAttemptRow(row: NarrativeAttemptRow): Record<
  number,
  { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined
> {
  const out: Record<
    number,
    { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined
  > = {};
  ([1, 2, 3] as const).forEach((n) => {
    const raw = row[`scenario_${n}_scores` as keyof NarrativeAttemptRow] as
      | Record<string, unknown>
      | null
      | undefined;
    if (!raw || typeof raw !== 'object') return;
    const ps = (raw as { pillarScores?: Record<string, number | null>; scenarioName?: string })
      .pillarScores;
    if (!ps || typeof ps !== 'object') return;
    out[n] = {
      pillarScores: ps,
      scenarioName: (raw as { scenarioName?: string }).scenarioName,
    };
  });
  return out;
}

async function persistNarrativeFailure(
  supabase: SupabaseClient,
  attemptId: string,
  existing: Record<string, unknown> | null,
  error: string,
  userId?: string,
): Promise<void> {
  let update = supabase
    .from('interview_attempts')
    .update({
      ai_reasoning: {
        ...buildReasoningFailurePatch(existing, error, { generationFailed: true }),
        _failedAt: new Date().toISOString(),
      },
      reasoning_pending: false,
    })
    .eq('id', attemptId);
  if (userId) update = update.eq('user_id', userId);
  const { error: upErr } = await update;
  if (upErr) {
    console.error(`[narrative] DB failure patch write failed for attempt ${attemptId}:`, upErr.message);
  }
}

export async function processNarrativeForAttempt(
  supabase: SupabaseClient,
  attemptId: string,
  opts?: { source?: string; userId?: string },
): Promise<{ ok: boolean; error?: string; skipped?: boolean }> {
  const source = opts?.source ?? 'processNarrativeForAttempt';
  console.log(`[narrative] Starting for attempt ${attemptId} (source=${source})`);

  let fetchQuery = supabase
    .from('interview_attempts')
    .select(
      'id, user_id, pillar_scores, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_specific_patterns, transcript, weighted_score, passed, ai_reasoning, reasoning_pending',
    )
    .eq('id', attemptId);
  if (opts?.userId) fetchQuery = fetchQuery.eq('user_id', opts.userId);

  const { data: rawRow, error: fetchErr } = await fetchQuery.maybeSingle();
  if (fetchErr || !rawRow) {
    console.error(`[narrative] Attempt ${attemptId} not found:`, fetchErr?.message ?? 'not_found');
    return { ok: false, error: fetchErr?.message ?? 'attempt_not_found' };
  }

  const row = rawRow as NarrativeAttemptRow;
  const ar = (row.ai_reasoning ?? null) as Record<string, unknown> | null;

  if (interviewAiReasoningIsSubstantive(ar)) {
    console.log(`[narrative] Attempt ${attemptId} already has substantive narrative — clearing pending`);
    await supabase.from('interview_attempts').update({ reasoning_pending: false }).eq('id', attemptId);
    return { ok: true, skipped: true };
  }

  let pillarScores = pillarScoresRecord(row.pillar_scores);
  if (Object.keys(pillarScores).length === 0) {
    const rolledUp = rollupPillarScoresFromStoredAttemptRow(row);
    if (rolledUp) {
      pillarScores = rolledUp;
      console.log(`[narrative] Rolled up pillar_scores for attempt ${attemptId}`);
      await supabase.from('interview_attempts').update({ pillar_scores: rolledUp }).eq('id', attemptId);
    }
  }

  if (Object.keys(pillarScores).length === 0) {
    const error = 'missing_pillar_scores';
    console.error(`[narrative] ${error} for attempt ${attemptId}`);
    await persistNarrativeFailure(supabase, attemptId, ar, error, opts?.userId);
    return { ok: false, error };
  }

  const transcript = Array.isArray(row.transcript)
    ? (row.transcript as Array<{ role: string; content?: string }>)
    : [];
  if (transcript.length === 0) {
    const error = 'missing_transcript';
    console.error(`[narrative] ${error} for attempt ${attemptId}`);
    await persistNarrativeFailure(supabase, attemptId, ar, error, opts?.userId);
    return { ok: false, error };
  }

  console.log(`[narrative] Attempt ${attemptId} fetched, calling model`);

  try {
    const evidenceContext = buildEvidenceContextFromAttemptPatterns(
      row.scenario_specific_patterns ?? null,
      row,
    );
    const reasoning = await generateAIReasoning(
      pillarScores,
      scenarioScoresFromAttemptRow(row),
      transcript,
      row.weighted_score,
      row.passed === true,
      [],
      {
        perAttemptTimeoutMs: NARRATIVE_BACKGROUND_TIMEOUT_MS,
        maxAttempts: 4,
        evidenceContext,
      },
    );

    if (!reasoning || typeof reasoning !== 'object') {
      const error = 'model_returned_null';
      console.error(`[narrative] Model returned null for attempt ${attemptId}`);
      await persistNarrativeFailure(supabase, attemptId, ar, error, opts?.userId);
      return { ok: false, error };
    }

    console.log(`[narrative] Model returned response, writing to DB for attempt ${attemptId}`);

    let updateQuery = supabase
      .from('interview_attempts')
      .update({
        ai_reasoning: reasoning as unknown as Record<string, unknown>,
        reasoning_pending: false,
      })
      .eq('id', attemptId);
    if (opts?.userId) updateQuery = updateQuery.eq('user_id', opts.userId);

    const { error: upErr } = await updateQuery;
    if (upErr) {
      console.error(`[narrative] DB write failed for attempt ${attemptId}:`, upErr.message);
      return { ok: false, error: upErr.message };
    }

    console.log(`[narrative] Completed successfully for attempt ${attemptId}`);
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[narrative] Unhandled error for attempt ${attemptId}:`, err);
    await persistNarrativeFailure(supabase, attemptId, ar, error, opts?.userId);
    return { ok: false, error };
  }
}
