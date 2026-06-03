/**
 * Client-side backup when server edge queued narrative (`reasoning_pending`) but background job did not finish.
 */
import { supabase } from '@data/supabase/client';
import {
  buildReasoningFailurePatch,
  recoverFailedReasoningPayload,
} from '@features/aria/aiReasoningPostProcess';
import { generateAIReasoning } from '@features/aria/generateAIReasoning';

const CLIENT_NARRATIVE_BACKUP_TIMEOUT_MS = 300_000;

export function interviewAiReasoningIsSubstantive(ar: Record<string, unknown> | null | undefined): boolean {
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

function scenarioScoresFromAttemptRow(row: {
  scenario_1_scores?: unknown;
  scenario_2_scores?: unknown;
  scenario_3_scores?: unknown;
}): Record<number, { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined> {
  const out: Record<
    number,
    { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined
  > = {};
  ([1, 2, 3] as const).forEach((n) => {
    const raw = row[`scenario_${n}_scores` as keyof typeof row] as Record<string, unknown> | null | undefined;
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

function pillarScoresRecord(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

export async function kickClientInterviewNarrativeIfPending(
  userId: string,
  attemptId: string,
  source: string
): Promise<{ skipped: boolean; ok?: boolean; error?: string }> {
  const { data: row, error: fetchErr } = await supabase
    .from('interview_attempts')
    .select(
      'id, user_id, pillar_scores, scenario_1_scores, scenario_2_scores, scenario_3_scores, transcript, weighted_score, passed, ai_reasoning, reasoning_pending'
    )
    .eq('id', attemptId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr || !row) {
    return { skipped: true, error: fetchErr?.message ?? 'attempt_not_found' };
  }

  const ar = (row.ai_reasoning ?? null) as Record<string, unknown> | null;
  if (interviewAiReasoningIsSubstantive(ar)) {
    return { skipped: true };
  }

  const pillars = pillarScoresRecord(row.pillar_scores);
  if (Object.keys(pillars).length === 0) {
    return { skipped: true, error: 'missing_pillar_scores' };
  }

  const transcript = Array.isArray(row.transcript)
    ? (row.transcript as Array<{ role: string; content?: string }>)
    : [];
  if (transcript.length === 0) {
    return { skipped: true, error: 'missing_transcript' };
  }

  try {
    const reasoning = await generateAIReasoning(
      pillars,
      scenarioScoresFromAttemptRow(row),
      transcript,
      row.weighted_score,
      row.passed === true,
      [],
      { perAttemptTimeoutMs: CLIENT_NARRATIVE_BACKUP_TIMEOUT_MS, maxAttempts: 2 }
    );
    await supabase
      .from('interview_attempts')
      .update({
        ai_reasoning: {
          ...(reasoning as unknown as Record<string, unknown>),
          _clientNarrativeBackup: true,
          _clientNarrativeBackupSource: source,
          _clientNarrativeBackupAt: new Date().toISOString(),
        },
        reasoning_pending: false,
      })
      .eq('id', attemptId)
      .eq('user_id', userId);
    return { skipped: false, ok: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (e instanceof Error && (e.name === 'AbortError' || /aborted/i.test(e.message))) {
      console.error('[Reasoning] AbortError on client narrative backup:', err);
    }
    await supabase
      .from('interview_attempts')
      .update({
        ai_reasoning: {
          ...buildReasoningFailurePatch(ar, err),
          _clientNarrativeBackupFailed: true,
          _clientNarrativeBackupSource: source,
        },
        reasoning_pending: false,
      })
      .eq('id', attemptId)
      .eq('user_id', userId);
    return { skipped: false, ok: false, error: err };
  }
}

/** Clear false failure flags when substantive narrative is already stored. */
export async function recoverFailedReasoningWithContent(attemptId: string): Promise<boolean> {
  const { data, error: fetchErr } = await supabase
    .from('interview_attempts')
    .select('ai_reasoning')
    .eq('id', attemptId)
    .maybeSingle();
  if (fetchErr || !data) return false;
  const recovered = recoverFailedReasoningPayload(
    (data.ai_reasoning ?? null) as Record<string, unknown> | null
  );
  if (!recovered) return false;
  console.log('[Reasoning] recovering attempt with failed flag but content present:', attemptId);
  const { error } = await supabase
    .from('interview_attempts')
    .update({ ai_reasoning: recovered, reasoning_pending: false })
    .eq('id', attemptId);
  return !error;
}
