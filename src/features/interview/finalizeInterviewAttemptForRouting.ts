import { supabase } from '@data/supabase/client';
import { personalMomentBundleWasScored } from '@features/aria/interviewCompletionGate';
import {
  isTruncatedPersonalMomentClosingReflection,
  transcriptHasInterviewClosingAssistantMessage,
} from '@features/aria/elongatingProbe';
import { transcriptEligibleForMoment5Scoring } from '@features/aria/moment5ScoringGuard';
import { scenarioScoresMeaningful } from '@utilities/waitForInterviewAttemptScoringReady';

import {
  fetchLatestNonPhantomInProgressAttemptId,
  type InterviewAttemptRowLike,
} from './interviewAttemptLifecycle';

export type InterviewAttemptRoutingRow = InterviewAttemptRowLike & {
  id?: string;
  attempt_number?: number | null;
  scenario_1_scores?: unknown;
  scenario_2_scores?: unknown;
  scenario_3_scores?: unknown;
  weighted_score?: number | null;
  scenario_specific_patterns?: Record<string, unknown> | null;
};

function finiteWeightedScore(raw: unknown): boolean {
  if (raw == null) return false;
  const n = Number(raw);
  return Number.isFinite(n);
}

function moment4ScoresFromPatterns(patterns: unknown): unknown {
  if (patterns == null || typeof patterns !== 'object' || Array.isArray(patterns)) return null;
  return (patterns as Record<string, unknown>).moment_4_scores ?? null;
}

/**
 * Holistic rollup or deferred Moment 4 scoring must be persisted before login routing
 * treats the attempt as complete (prevents bypassing client M4/M5 + edge holistic).
 */
export function attemptHasPersistedScoringForRoutingFinalize(
  row: InterviewAttemptRoutingRow | null | undefined,
): boolean {
  if (!row) return false;
  if (finiteWeightedScore(row.weighted_score)) return true;
  return personalMomentBundleWasScored(moment4ScoresFromPatterns(row.scenario_specific_patterns));
}

function transcriptHasFinalInterviewClosingAssistantMessage(transcript: unknown): boolean {
  if (!Array.isArray(transcript)) return false;
  return (transcript as ReadonlyArray<{ role: string; content?: string }>).some(
    (m) =>
      m.role === 'assistant' &&
      transcriptHasInterviewClosingAssistantMessage([m]) &&
      !isTruncatedPersonalMomentClosingReflection(m.content ?? ''),
  );
}

export function attemptTranscriptHasSubstantiveMoment5UserAnswer(transcript: unknown): boolean {
  return transcriptEligibleForMoment5Scoring(
    Array.isArray(transcript) ? (transcript as Parameters<typeof transcriptEligibleForMoment5Scoring>[0]) : null,
  );
}

/** Transcript + scenario slices look finished (content only; not sufficient for routing finalize). */
export function attemptTranscriptInterviewContentComplete(
  row: InterviewAttemptRoutingRow | null | undefined,
): boolean {
  if (!row || row.is_phantom === true) return false;
  const transcript = row.transcript;
  const transcriptFinished =
    transcriptHasFinalInterviewClosingAssistantMessage(transcript) ||
    attemptTranscriptHasSubstantiveMoment5UserAnswer(transcript);
  if (!transcriptFinished) return false;
  return (
    scenarioScoresMeaningful(row.scenario_1_scores) &&
    scenarioScoresMeaningful(row.scenario_2_scores) &&
    scenarioScoresMeaningful(row.scenario_3_scores)
  );
}

/** Finished session content + persisted scoring inputs — safe to commit routing completion. */
export function attemptIndicatesInterviewSessionFinished(
  row: InterviewAttemptRoutingRow | null | undefined,
): boolean {
  return (
    attemptTranscriptInterviewContentComplete(row) &&
    attemptHasPersistedScoringForRoutingFinalize(row)
  );
}

/** `completed_at` alone is not enough when legacy rows skipped scoring. */
export function attemptCompletedAtReflectsScoredInterview(
  row: InterviewAttemptRoutingRow | null | undefined,
): boolean {
  if (row?.completed_at == null || String(row.completed_at).length === 0) return false;
  return attemptHasPersistedScoringForRoutingFinalize(row);
}

const ATTEMPT_ROUTING_RECONCILE_SELECT =
  'id, completed_at, transcript, is_phantom, attempt_number, scenario_1_scores, scenario_2_scores, scenario_3_scores, weighted_score, scenario_specific_patterns';

/**
 * Marks a finished-but-unfinalized attempt complete for login routing.
 * Idempotent when `completed_at` is already set with persisted scoring.
 */
export async function finalizeInterviewAttemptForRouting(
  userId: string,
  attemptId: string,
): Promise<boolean> {
  const { data: attempt, error } = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_ROUTING_RECONCILE_SELECT)
    .eq('id', attemptId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !attempt?.id) return false;
  if (attemptCompletedAtReflectsScoredInterview(attempt as InterviewAttemptRoutingRow)) {
    return true;
  }
  if (!attemptIndicatesInterviewSessionFinished(attempt as InterviewAttemptRoutingRow)) {
    return false;
  }

  const completedAt = new Date().toISOString();
  const { error: attemptErr } = await supabase
    .from('interview_attempts')
    .update({ completed_at: completedAt })
    .eq('id', attemptId)
    .eq('user_id', userId)
    .is('completed_at', null);

  if (attemptErr) {
    console.warn('[finalizeInterviewAttemptForRouting] attempt update failed:', attemptErr.message);
    return false;
  }

  const attemptNumber =
    typeof attempt.attempt_number === 'number' && Number.isFinite(attempt.attempt_number)
      ? attempt.attempt_number
      : 1;

  const { error: userErr } = await supabase
    .from('users')
    .update({
      interview_completed: true,
      interview_completed_at: completedAt,
      latest_attempt_id: attemptId,
      interview_attempt_count: attemptNumber,
    })
    .eq('id', userId);

  if (userErr) {
    console.warn('[finalizeInterviewAttemptForRouting] users update failed:', userErr.message);
    return false;
  }

  const { data: verifiedAttempt, error: verifyAttemptErr } = await supabase
    .from('interview_attempts')
    .select('completed_at')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .maybeSingle();

  if (verifyAttemptErr || !verifiedAttempt?.completed_at) {
    console.warn(
      '[finalizeInterviewAttemptForRouting] attempt completed_at not visible after update',
      verifyAttemptErr?.message,
    );
    return false;
  }

  const { data: verifiedUser, error: verifyUserErr } = await supabase
    .from('users')
    .select('interview_completed')
    .eq('id', userId)
    .maybeSingle();

  if (verifyUserErr || verifiedUser?.interview_completed !== true) {
    console.warn(
      '[finalizeInterviewAttemptForRouting] users.interview_completed not visible after update',
      verifyUserErr?.message,
    );
    return false;
  }

  return true;
}

/** Resolve latest in-progress attempt that looks finished and finalize it for routing. */
export async function reconcileUnfinalizedInterviewAttemptForUser(userId: string): Promise<boolean> {
  const attemptId = await fetchLatestNonPhantomInProgressAttemptId(userId);
  if (!attemptId) return false;
  return finalizeInterviewAttemptForRouting(userId, attemptId);
}
