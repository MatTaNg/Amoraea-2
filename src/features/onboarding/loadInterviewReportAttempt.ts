import { supabase } from '@data/supabase/client';
import { resolvePillarScoresForNarrativeFromAttempt } from '@features/aria/resolvePillarScoresForNarrative';
import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';
import { finalizeInterviewOnlyGateForAttempt } from '@features/psychometrics/finalizeInterviewOnlyGate';
import {
  kickClientInterviewNarrativeIfPending,
  narrativeFailedWithMissingPillarScores,
} from '@utilities/kickClientInterviewNarrativeIfPending';

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
  /** Resolved for UI — may be rolled up client-side from scenario slices when DB pillars lag. */
  pillar_scores: Record<string, number> | null;
  /** True when `interview_attempts.pillar_scores` itself has numeric values. */
  hasPersistedPillarScores: boolean;
  /** True when `interview_attempts.weighted_score` is stored (not only client rollup). */
  hasPersistedWeightedScore: boolean;
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

const INTERVIEW_REPORT_ATTEMPT_SELECT = `
  id,
  weighted_score,
  modified_weighted_score,
  modified_weighted_score_with_psychometrics,
  final_gate_pass,
  passed,
  gate_fail_reasons,
  psychometric_modifier_applied,
  corrected_psychometric_modifier,
  reasoning_pending,
  ai_reasoning,
  pillar_scores,
  gate_result_finalized_at,
  transcript,
  scenario_1_scores,
  scenario_2_scores,
  scenario_3_scores,
  scenario_specific_patterns,
  skip_count,
  ego_development_level,
  language_markers,
  defense_patterns,
  disclosure_calibration,
  mentalizing_overcertainty_count,
  skip_penalty_total,
  auto_failed,
  moment_4_concreteness,
  moment_5_concreteness,
  personal_moment_emotional_vocab_density,
  personal_moment_emotional_vocab_low
` as const;

export type InterviewAttemptPillarSourceRow = {
  pillar_scores?: unknown;
  transcript?: unknown;
  scenario_1_scores?: unknown;
  scenario_2_scores?: unknown;
  scenario_3_scores?: unknown;
  scenario_specific_patterns?: unknown;
  weighted_score?: number | null;
  skip_count?: number | string | null;
  ego_development_level?: unknown;
  language_markers?: unknown;
  defense_patterns?: unknown;
  disclosure_calibration?: unknown;
  mentalizing_overcertainty_count?: number | null;
  skip_penalty_total?: number | null;
  auto_failed?: boolean | null;
  moment_4_concreteness?: unknown;
  moment_5_concreteness?: unknown;
  personal_moment_emotional_vocab_density?: number | null;
  personal_moment_emotional_vocab_low?: boolean | null;
  passed?: boolean | null;
};

/** Stored holistic pillars, or rollup from saved scenario/moment slices when inserts lag behind. */
export function resolveAttemptPillarScoresForReport(
  row: InterviewAttemptPillarSourceRow,
): Record<string, number> | null {
  const stored = normalizePillarScores(row.pillar_scores);
  if (stored) return stored;
  const resolution = resolvePillarScoresForNarrativeFromAttempt(row, row.passed === true);
  if (resolution && Object.keys(resolution.pillar_scores).length > 0) {
    return resolution.pillar_scores;
  }
  return averagePillarScoresFromScenarioBundles(row);
}

function averagePillarScoresFromScenarioBundles(
  row: InterviewAttemptPillarSourceRow,
): Record<string, number> | null {
  const sums = new Map<string, number[]>();
  for (const scenarioKey of ['scenario_1_scores', 'scenario_2_scores', 'scenario_3_scores'] as const) {
    const bundle = normalizePillarScores(row[scenarioKey]);
    if (!bundle) continue;
    for (const [key, value] of Object.entries(bundle)) {
      if (!Number.isFinite(value)) continue;
      const bucket = sums.get(key) ?? [];
      bucket.push(value);
      sums.set(key, bucket);
    }
  }
  if (sums.size === 0) return null;
  const out: Record<string, number> = {};
  for (const [key, values] of sums.entries()) {
    out[key] = values.reduce((acc, n) => acc + n, 0) / values.length;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function mapInterviewReportAttemptRow(data: Record<string, unknown>): InterviewReportAttempt {
  const aiReasoning =
    data.ai_reasoning != null && typeof data.ai_reasoning === 'object' && !Array.isArray(data.ai_reasoning)
      ? (data.ai_reasoning as Record<string, unknown>)
      : null;
  const pillarSource = data as InterviewAttemptPillarSourceRow;
  const storedPillars = normalizePillarScores(data.pillar_scores);
  const resolvedPillars = resolveAttemptPillarScoresForReport(pillarSource);
  const rollup = resolvePillarScoresForNarrativeFromAttempt(pillarSource, data.passed === true);
  const hasPersistedWeightedScore = typeof data.weighted_score === 'number';

  return {
    id: String(data.id),
    weighted_score: hasPersistedWeightedScore
      ? (data.weighted_score as number)
      : (rollup?.weighted_score ?? null),
    modified_weighted_score:
      typeof data.modified_weighted_score === 'number' ? data.modified_weighted_score : null,
    modified_weighted_score_with_psychometrics:
      typeof data.modified_weighted_score_with_psychometrics === 'number'
        ? data.modified_weighted_score_with_psychometrics
        : null,
    final_gate_pass: typeof data.final_gate_pass === 'boolean' ? data.final_gate_pass : null,
    passed: typeof data.passed === 'boolean' ? data.passed : (rollup?.passed ?? null),
    gate_fail_reasons: asStringArray(data.gate_fail_reasons),
    psychometric_modifier_applied:
      typeof data.psychometric_modifier_applied === 'number' ? data.psychometric_modifier_applied : null,
    corrected_psychometric_modifier:
      typeof data.corrected_psychometric_modifier === 'number'
        ? data.corrected_psychometric_modifier
        : null,
    reasoning_pending: data.reasoning_pending === true,
    ai_reasoning: aiReasoning,
    pillar_scores: resolvedPillars,
    hasPersistedPillarScores: storedPillars != null,
    hasPersistedWeightedScore,
    gate_result_finalized_at:
      typeof data.gate_result_finalized_at === 'string' ? data.gate_result_finalized_at : null,
  };
}

/** Persist rollup / kick narrative backup when the partial-report screen loads. */
export async function refreshInterviewReportAttemptForPartialReport(
  userId: string,
): Promise<InterviewReportAttempt | null> {
  const row = await loadInterviewReportAttempt(userId);
  if (!row?.id) return row;

  // Must check persisted DB columns — client-resolved pillars from S1–S3 used to mask
  // missing holistic rollup and skip finalize, so partial report generation had thin/empty data.
  const needsPersistedRollup = !row.hasPersistedPillarScores || !row.hasPersistedWeightedScore;
  if (needsPersistedRollup) {
    await finalizeInterviewOnlyGateForAttempt(userId, row.id);
  }

  const refreshed = (await loadInterviewReportAttempt(userId)) ?? row;

  const shouldKickNarrative =
    refreshed.reasoning_pending ||
    (refreshed.hasPersistedPillarScores &&
      narrativeFailedWithMissingPillarScores(refreshed.ai_reasoning));
  if (shouldKickNarrative) {
    void kickClientInterviewNarrativeIfPending(
      userId,
      refreshed.id,
      'interview_complete_partial_report',
    );
  }

  return refreshed;
}

export async function loadInterviewReportAttempt(
  userId: string,
  attemptId?: string | null,
): Promise<InterviewReportAttempt | null> {
  const resolvedId = attemptId ?? (await fetchMostRecentCompletedInterviewAttemptId(userId));
  if (!resolvedId) return null;

  const { data, error } = await supabase
    .from('interview_attempts')
    .select(INTERVIEW_REPORT_ATTEMPT_SELECT)
    .eq('id', resolvedId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return mapInterviewReportAttemptRow(data as Record<string, unknown>);
}
