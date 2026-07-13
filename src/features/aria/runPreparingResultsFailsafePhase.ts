import {
  isCompletionScoringInFlight,
  wasCompletionScoringAttempted,
} from '@features/aria/completionScoringKick';
import { clearPreparingResultsSession } from '@features/aria/interviewLocalPersistence';
import type {
  PreparingResultsFailsafeDeps,
  PreparingResultsFailsafePhase,
} from '@features/aria/preparingResultsFailsafeTypes';
import { supabase } from '@data/supabase/client';
import {
  recoverStuckPreparingResultsForStandardUser,
  replaceWithStandardApplicantPostInterviewHandoffForUser,
  resolveStandardApplicantCohort,
  resolveStandardPostInterviewHandoffEligible,
} from '@features/aria/interviewPostInterviewHandoff';
import { clearInterviewFromStorage } from '@utilities/storage/InterviewStorage';
import { remoteLog } from '@utilities/remoteLog';

export async function runPreparingResultsFailsafePhase(
  deps: PreparingResultsFailsafeDeps,
  phase: PreparingResultsFailsafePhase,
  isCancelled: () => boolean,
): Promise<void> {
  const {
    userId,
    isInterviewAppRoute,
    userEmail,
    navigation,
    interviewStatusRef,
    scoreInterviewInFlightRef,
    scoreInterviewAttemptedRef,
    pendingCompletionTranscriptRef,
    interviewSessionAttemptIdRef,
    interviewSessionIdRef,
    setPendingScoringSyncAttemptId,
    kickCompletionScoring,
  } = deps;

  if (isCancelled() || interviewStatusRef.current !== 'preparing_results') return;
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionEmail = sessionData.session?.user?.email ?? null;
  const handoff = await resolveStandardPostInterviewHandoffEligible(userId, {
    isInterviewAppRoute,
    sessionEmail,
    profileEmail: userEmail,
  });
  if (isCancelled() || interviewStatusRef.current !== 'preparing_results') return;
  if (scoreInterviewInFlightRef.current || isCompletionScoringInFlight()) {
    return;
  }
  if (!wasCompletionScoringAttempted() && !scoreInterviewAttemptedRef.current) {
    const pendingTx = pendingCompletionTranscriptRef.current;
    if (pendingTx?.length && kickCompletionScoring(`preparing_results_failsafe_${phase}`, pendingTx)) {
      scoreInterviewAttemptedRef.current = true;
      await remoteLog('[WARN] preparing_results_failsafe_kick_score_interview', {
        phase,
        transcriptTurns: pendingTx.length,
        attemptId: interviewSessionAttemptIdRef.current,
      });
      return;
    }
  }
  if (phase === 'edge_retry') {
    await remoteLog('[WARN] preparing_results_edge_retry_deferred_scoring_only', {
      attemptId: interviewSessionAttemptIdRef.current,
      scoreInterviewAttempted: scoreInterviewAttemptedRef.current,
    });
    return;
  }
  if (handoff.shouldHandOff) {
    clearPreparingResultsSession(userId);
    await clearInterviewFromStorage(userId);
    replaceWithStandardApplicantPostInterviewHandoffForUser(navigation, userId, {
      interviewSessionId: interviewSessionIdRef.current,
      source: 'preparing_results_failsafe',
    });
    await remoteLog('[WARN] preparing_results_failsafe_handoff', { userId, phase });
    return;
  }
  const attemptId =
    handoff.latestAttemptId ??
    (typeof interviewSessionAttemptIdRef.current === 'string' &&
    interviewSessionAttemptIdRef.current.length > 0
      ? interviewSessionAttemptIdRef.current
      : null);
  if (!attemptId) {
    await remoteLog('[WARN] preparing_results_failsafe_no_attempt', { userId, phase });
    return;
  }
  const isStandardCohort = await resolveStandardApplicantCohort(userId, {
    isInterviewAppRoute,
    sessionEmail,
    profileEmail: userEmail,
  });
  if (!isStandardCohort) {
    setPendingScoringSyncAttemptId((prev) => (prev === attemptId ? prev : attemptId));
    return;
  }
  if (scoreInterviewInFlightRef.current || isCompletionScoringInFlight()) {
    await remoteLog('[WARN] preparing_results_force_deferred_in_flight', { attemptId, phase });
    return;
  }
  if (!wasCompletionScoringAttempted() && !scoreInterviewAttemptedRef.current) {
    const pendingTx = pendingCompletionTranscriptRef.current;
    if (pendingTx?.length && kickCompletionScoring('preparing_results_failsafe_force', pendingTx)) {
      scoreInterviewAttemptedRef.current = true;
      await remoteLog('[WARN] preparing_results_force_last_kick_score_interview', { attemptId });
      return;
    }
  }
  await recoverStuckPreparingResultsForStandardUser(navigation, userId, attemptId, {
    interviewSessionId: interviewSessionIdRef.current,
    source: 'preparing_results_failsafe_force',
  });
}
