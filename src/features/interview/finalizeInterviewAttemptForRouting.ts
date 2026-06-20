import { supabase } from '@data/supabase/client';
import { transcriptHasInterviewClosingAssistantMessage } from '@features/aria/elongatingProbe';
import { countInterviewWords } from '@features/aria/moment4SpecificityFollowUp';
import { transcriptAssistantContainsMoment5PrimaryConflictQuestion } from '@features/aria/probeAndScoringUtils';
import { scenarioScoresMeaningful } from '@utilities/waitForInterviewAttemptScoringReady';

import {
  fetchLatestNonPhantomInProgressAttemptId,
  MIN_FIRST_SUBSTANTIVE_RESPONSE_WORDS,
  type InterviewAttemptRowLike,
} from './interviewAttemptLifecycle';

export type InterviewAttemptRoutingRow = InterviewAttemptRowLike & {
  id?: string;
  attempt_number?: number | null;
  scenario_1_scores?: unknown;
  scenario_2_scores?: unknown;
  scenario_3_scores?: unknown;
};

function transcriptTurnHasSubstantiveUserContent(content: string | null | undefined): boolean {
  return countInterviewWords(content ?? '') >= MIN_FIRST_SUBSTANTIVE_RESPONSE_WORDS;
}

export function attemptTranscriptHasSubstantiveMoment5UserAnswer(transcript: unknown): boolean {
  if (!Array.isArray(transcript)) return false;
  for (const turn of transcript) {
    if (!turn || typeof turn !== 'object') continue;
    const row = turn as { role?: string; content?: string; interviewMoment?: number };
    if (row.role !== 'user') continue;
    if (row.interviewMoment === 5 && transcriptTurnHasSubstantiveUserContent(row.content)) {
      return true;
    }
  }

  // Persisted transcripts may omit `interviewMoment` on the final personal-conflict answer.
  for (let i = 0; i < transcript.length; i++) {
    const turn = transcript[i];
    if (!turn || typeof turn !== 'object') continue;
    const row = turn as { role?: string; content?: string };
    if (row.role !== 'assistant') continue;
    if (!transcriptAssistantContainsMoment5PrimaryConflictQuestion(row.content)) continue;
    for (let j = i + 1; j < transcript.length; j++) {
      const next = transcript[j] as { role?: string; content?: string };
      if (next?.role === 'user' && transcriptTurnHasSubstantiveUserContent(next.content)) {
        return true;
      }
    }
  }

  return false;
}

/** Finished session content exists but `completed_at` / `users.interview_completed` were never committed. */
export function attemptIndicatesInterviewSessionFinished(
  row: InterviewAttemptRoutingRow | null | undefined,
): boolean {
  if (!row || row.is_phantom === true) return false;
  const transcript = row.transcript;
  const transcriptFinished =
    transcriptHasInterviewClosingAssistantMessage(
      Array.isArray(transcript)
        ? (transcript as ReadonlyArray<{ role: string; content?: string }>)
        : [],
    ) || attemptTranscriptHasSubstantiveMoment5UserAnswer(transcript);
  if (!transcriptFinished) return false;
  return (
    scenarioScoresMeaningful(row.scenario_1_scores) &&
    scenarioScoresMeaningful(row.scenario_2_scores) &&
    scenarioScoresMeaningful(row.scenario_3_scores)
  );
}

const ATTEMPT_ROUTING_RECONCILE_SELECT =
  'id, completed_at, transcript, is_phantom, attempt_number, scenario_1_scores, scenario_2_scores, scenario_3_scores';

/**
 * Marks a finished-but-unfinalized attempt complete for login routing.
 * Idempotent when `completed_at` is already set.
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
  if (attempt.completed_at != null && String(attempt.completed_at).length > 0) {
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
