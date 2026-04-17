/**
 * Admin console: regenerate narrative AI reasoning for an interview_attempts row (service scores already stored).
 */
import { supabase } from '@data/supabase/client';
import { generateAIReasoning } from '@features/aria/generateAIReasoning';
import type { AIReasoningResult } from '@features/aria/generateAIReasoning';

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

export async function adminRetryAIReasoningForAttempt(attemptId: string): Promise<{ ok: true } | { error: string }> {
  const { data: row, error: fetchErr } = await supabase
    .from('interview_attempts')
    .select(
      'id, pillar_scores, scenario_1_scores, scenario_2_scores, scenario_3_scores, transcript, weighted_score, passed'
    )
    .eq('id', attemptId)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!row) return { error: 'Attempt not found' };

  const r = row as AttemptRow;
  const pillarScores = (r.pillar_scores ?? {}) as Record<string, number>;
  const transcript = (r.transcript ?? []) as Array<{ role: string; content?: string }>;
  const scenarioScores = scenarioScoresFromAttempt(r);

  let reasoning: AIReasoningResult;
  try {
    reasoning = await generateAIReasoning(
      pillarScores,
      scenarioScores,
      transcript,
      r.weighted_score,
      r.passed === true,
      [],
      null
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  const { error: upErr } = await supabase
    .from('interview_attempts')
    .update({
      ai_reasoning: reasoning as unknown as Record<string, unknown>,
      reasoning_pending: false,
    })
    .eq('id', attemptId);

  if (upErr) return { error: upErr.message };
  return { ok: true };
}
