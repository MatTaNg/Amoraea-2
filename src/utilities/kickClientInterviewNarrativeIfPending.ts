/**
 * Client-side backup when server edge queued narrative (`reasoning_pending`) but background job did not finish.
 */
import { supabase } from '@data/supabase/client';
import {
  buildReasoningFailurePatch,
  recoverFailedReasoningPayload,
} from '@features/aria/aiReasoningPostProcess';
import { generateAIReasoning } from '@features/aria/generateAIReasoning';
import {
  resolvePillarScoresForNarrativeFromAttempt,
  type NarrativeAttemptRowInput,
  type NarrativePillarResolution,
} from '@features/aria/resolvePillarScoresForNarrative';
import { finalizeInterviewOnlyGateForAttempt } from '@features/psychometrics/finalizeInterviewOnlyGate';
import { buildEvidenceContextFromAttemptPatterns } from '@features/reports/narrativeEvidenceAudit';

const CLIENT_NARRATIVE_BACKUP_TIMEOUT_MS = 300_000;
const NARRATIVE_ATTEMPT_SELECT =
  'id, user_id, pillar_scores, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_specific_patterns, transcript, weighted_score, passed, ai_reasoning, reasoning_pending, skip_count, ego_development_level, language_markers, defense_patterns, disclosure_calibration, mentalizing_overcertainty_count, skip_penalty_total, auto_failed, moment_4_concreteness, moment_5_concreteness, personal_moment_emotional_vocab_density, personal_moment_emotional_vocab_low';

type NarrativeAttemptRow = NarrativeAttemptRowInput & {
  id: string;
  user_id: string;
  ai_reasoning?: unknown;
  reasoning_pending?: boolean | null;
  passed?: boolean | null;
  weighted_score?: number | null;
  transcript?: unknown;
  scenario_specific_patterns?: unknown;
};

const NARRATIVE_PILLAR_WAIT_MS = [1500, 2500, 4000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function narrativeFailedWithMissingPillarScores(
  ar: Record<string, unknown> | null | undefined,
): boolean {
  if (!ar || typeof ar !== 'object') return false;
  const lastError = ar.last_error ?? ar._lastError;
  return ar._generationFailed === true && lastError === 'missing_pillar_scores';
}

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

async function fetchNarrativeAttemptRow(
  userId: string,
  attemptId: string,
): Promise<NarrativeAttemptRow | null> {
  const { data, error } = await supabase
    .from('interview_attempts')
    .select(NARRATIVE_ATTEMPT_SELECT)
    .eq('id', attemptId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as NarrativeAttemptRow;
}

async function resolvePillarScoresForNarrativeWithWait(
  userId: string,
  attemptId: string,
  initialRow: NarrativeAttemptRow,
): Promise<{ row: NarrativeAttemptRow; resolution: NarrativePillarResolution | null }> {
  let row = initialRow;
  let resolution = resolvePillarScoresForNarrativeFromAttempt(row, row.passed === true);
  if (resolution) return { row, resolution };

  for (const delayMs of NARRATIVE_PILLAR_WAIT_MS) {
    await sleep(delayMs);
    const refetched = await fetchNarrativeAttemptRow(userId, attemptId);
    if (!refetched) continue;
    row = refetched;
    resolution = resolvePillarScoresForNarrativeFromAttempt(row, row.passed === true);
    if (resolution) return { row, resolution };
  }

  await finalizeInterviewOnlyGateForAttempt(userId, attemptId);
  const afterFinalize = await fetchNarrativeAttemptRow(userId, attemptId);
  if (afterFinalize) {
    row = afterFinalize;
    resolution = resolvePillarScoresForNarrativeFromAttempt(row, row.passed === true);
  }
  return { row, resolution };
}

async function persistRollupIfNeeded(
  attemptId: string,
  userId: string,
  resolution: ReturnType<typeof resolvePillarScoresForNarrativeFromAttempt>,
): Promise<void> {
  if (!resolution?.fromRollup) return;
  await supabase
    .from('interview_attempts')
    .update({
      pillar_scores: resolution.pillar_scores,
      ...(resolution.weighted_score != null ? { weighted_score: resolution.weighted_score } : {}),
      ...(resolution.passed != null ? { passed: resolution.passed } : {}),
      depth_signal_modifier: resolution.depth_signal_modifier ?? 0,
      score_modifier: resolution.score_modifier ?? 0,
      modified_weighted_score:
        resolution.modified_weighted_score ?? resolution.weighted_score ?? null,
    })
    .eq('id', attemptId)
    .eq('user_id', userId);
}

export async function kickClientInterviewNarrativeIfPending(
  userId: string,
  attemptId: string,
  source: string
): Promise<{ skipped: boolean; ok?: boolean; error?: string }> {
  console.log(`[narrative] Starting for attempt ${attemptId} (source=${source})`);
  const row = await fetchNarrativeAttemptRow(userId, attemptId);
  if (!row) {
    console.error(`[narrative] Attempt ${attemptId} not found`);
    return { skipped: true, error: 'attempt_not_found' };
  }

  const ar = (row.ai_reasoning ?? null) as Record<string, unknown> | null;
  if (interviewAiReasoningIsSubstantive(ar)) {
    console.log(`[narrative] Attempt ${attemptId} already has substantive narrative — skipping client backup`);
    if (row.reasoning_pending === true) {
      await supabase
        .from('interview_attempts')
        .update({ reasoning_pending: false })
        .eq('id', attemptId)
        .eq('user_id', userId);
    }
    return { skipped: true };
  }

  const resolved = await resolvePillarScoresForNarrativeWithWait(userId, attemptId, row);
  const rowForNarrative = resolved.row;
  const resolution = resolved.resolution;
  if (!resolution) {
    const error = 'missing_pillar_scores';
    console.error(
      `[narrative] ${error} for attempt ${attemptId} — rollup still in flight; keeping reasoning_pending`,
    );
    await supabase
      .from('interview_attempts')
      .update({
        reasoning_pending: true,
        ai_reasoning: {
          ...(ar ?? {}),
          _reasoningPending: true,
          note: 'Narrative generation queued (waiting for interview scores).',
          _queuedAt: new Date().toISOString(),
          _clientNarrativeBackupSource: source,
        },
      })
      .eq('id', attemptId)
      .eq('user_id', userId);
    return { skipped: true, error };
  }
  const pillars = resolution.pillar_scores;
  await persistRollupIfNeeded(attemptId, userId, resolution);

  const transcript = Array.isArray(rowForNarrative.transcript)
    ? (rowForNarrative.transcript as Array<{ role: string; content?: string }>)
    : [];
  if (transcript.length === 0) {
    const error = 'missing_transcript';
    console.error(`[narrative] ${error} for attempt ${attemptId}`);
    if (rowForNarrative.reasoning_pending === true) {
      await supabase
        .from('interview_attempts')
        .update({
          ai_reasoning: {
            ...buildReasoningFailurePatch(ar, error, { generationFailed: true }),
            _clientNarrativeBackupSource: source,
            _failedAt: new Date().toISOString(),
          },
          reasoning_pending: false,
        })
        .eq('id', attemptId)
        .eq('user_id', userId);
    }
    return { skipped: true, error };
  }

  try {
    console.log(`[narrative] Attempt ${attemptId} fetched, calling model`);
    const evidenceContext = buildEvidenceContextFromAttemptPatterns(
      (rowForNarrative.scenario_specific_patterns ?? null) as Record<string, unknown> | null,
      rowForNarrative,
    );
    const reasoning = await generateAIReasoning(
      pillars,
      scenarioScoresFromAttemptRow(rowForNarrative),
      transcript,
      rowForNarrative.weighted_score ?? resolution.weighted_score,
      resolution.passed ?? rowForNarrative.passed === true,
      [],
      {
        perAttemptTimeoutMs: CLIENT_NARRATIVE_BACKUP_TIMEOUT_MS,
        maxAttempts: 4,
        evidenceContext,
      },
    );
    console.log(`[narrative] Model returned response, writing to DB for attempt ${attemptId}`);
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
    console.log(`[narrative] Completed successfully for attempt ${attemptId}`);
    return { skipped: false, ok: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (e instanceof Error && (e.name === 'AbortError' || /aborted/i.test(e.message))) {
      console.error('[narrative] AbortError on client narrative backup:', err);
    }
    console.error(`[narrative] Unhandled error for attempt ${attemptId}:`, e);
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
