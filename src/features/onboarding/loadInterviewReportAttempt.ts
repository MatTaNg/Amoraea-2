import { supabase } from '@data/supabase/client';
import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';

export const INTERVIEW_REPORT_PILLAR_KEYS = [
  'repair',
  'contempt',
  'attunement',
  'regulation',
  'mentalizing',
  'appreciation',
  'accountability',
  'commitment_threshold',
] as const;

export type InterviewReportPillarKey = (typeof INTERVIEW_REPORT_PILLAR_KEYS)[number];

export type InterviewReportAttempt = {
  id: string;
  weighted_score: number | null;
  modified_weighted_score: number | null;
  modified_weighted_score_with_psychometrics: number | null;
  final_gate_pass: boolean | null;
  passed: boolean | null;
  gate_fail_reasons: string[] | null;
  psychometric_modifier_applied: number | null;
  corrected_psychometric_modifier: number | null;
  reasoning_pending: boolean;
  ai_reasoning: Record<string, unknown> | null;
  pillar_scores: Record<string, number> | null;
  gate_result_finalized_at: string | null;
};

function normalizePillarScores(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const inner = o.pillarScores ?? o.pillar_scores;
  const source =
    inner != null && typeof inner === 'object' && !Array.isArray(inner)
      ? (inner as Record<string, unknown>)
      : o;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(source)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function asStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

export function readPillarScore(
  pillars: Record<string, number> | null | undefined,
  key: InterviewReportPillarKey,
): number | null {
  if (!pillars) return null;
  const v = pillars[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export async function loadInterviewReportAttempt(
  userId: string,
  attemptId?: string | null,
): Promise<InterviewReportAttempt | null> {
  const resolvedId = attemptId ?? (await fetchMostRecentCompletedInterviewAttemptId(userId));
  if (!resolvedId) return null;

  const { data, error } = await supabase
    .from('interview_attempts')
    .select(
      'id, weighted_score, modified_weighted_score, modified_weighted_score_with_psychometrics, final_gate_pass, passed, gate_fail_reasons, psychometric_modifier_applied, corrected_psychometric_modifier, reasoning_pending, ai_reasoning, pillar_scores, gate_result_finalized_at',
    )
    .eq('id', resolvedId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  const aiReasoning =
    data.ai_reasoning != null && typeof data.ai_reasoning === 'object' && !Array.isArray(data.ai_reasoning)
      ? (data.ai_reasoning as Record<string, unknown>)
      : null;

  return {
    id: data.id,
    weighted_score: typeof data.weighted_score === 'number' ? data.weighted_score : null,
    modified_weighted_score:
      typeof data.modified_weighted_score === 'number' ? data.modified_weighted_score : null,
    modified_weighted_score_with_psychometrics:
      typeof data.modified_weighted_score_with_psychometrics === 'number'
        ? data.modified_weighted_score_with_psychometrics
        : null,
    final_gate_pass: typeof data.final_gate_pass === 'boolean' ? data.final_gate_pass : null,
    passed: typeof data.passed === 'boolean' ? data.passed : null,
    gate_fail_reasons: asStringArray(data.gate_fail_reasons),
    psychometric_modifier_applied:
      typeof data.psychometric_modifier_applied === 'number' ? data.psychometric_modifier_applied : null,
    corrected_psychometric_modifier:
      typeof data.corrected_psychometric_modifier === 'number'
        ? data.corrected_psychometric_modifier
        : null,
    reasoning_pending: data.reasoning_pending === true,
    ai_reasoning: aiReasoning,
    pillar_scores: normalizePillarScores(data.pillar_scores),
    gate_result_finalized_at:
      typeof data.gate_result_finalized_at === 'string' ? data.gate_result_finalized_at : null,
  };
}
