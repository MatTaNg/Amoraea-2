import type {
  PendingScoringSyncPollDeps,
  PendingScoringSyncPollSignal,
  PendingScoringSyncPollTrigger,
} from '@features/aria/interviewPostScoringEffectsTypes';
import { getSessionLogRuntime } from '@utilities/sessionLogging';

export async function runPendingScoringSyncPoll(
  deps: PendingScoringSyncPollDeps,
  trigger: PendingScoringSyncPollTrigger,
  signal: PendingScoringSyncPollSignal,
): Promise<void> {
  const attemptId = trigger.pendingScoringSyncAttemptId;
  const userId = trigger.userId;
  if (!attemptId || !userId) return;

  const ok = await deps.waitForInterviewAttemptScoringReady(deps.supabase, attemptId, {
    maxMs: 180_000,
    intervalMs: 600,
  });
  if (signal.isCancelled()) return;
  if (!ok) {
    await deps.remoteLog('[WARN] pending_scoring_sync_poll_exhausted', {
      attemptId,
      action: 'stay_on_preparing_results',
    });
    return;
  }
  deps.setPendingScoringSyncAttemptId(null);
  deps.setAnalysisAttemptId(attemptId);
  deps.clearPreparingResultsSession(userId);
  await deps.runCommunicationStylePipelineAfterSave(userId, attemptId, deps.interviewSessionIdRef.current, {
    platform: getSessionLogRuntime().platform,
  });
  const { data: sessionData } = await deps.supabase.auth.getSession();
  const sessionEmail = sessionData.session?.user?.email ?? null;
  const handoff = await deps.resolveStandardPostInterviewHandoffEligible(userId, {
    isInterviewAppRoute: trigger.isInterviewAppRoute,
    sessionEmail,
    profileEmail: trigger.userEmail,
  });
  if (handoff.shouldHandOff || deps.isValidationTrackInterviewHandoffActive()) {
    await deps.clearInterviewFromStorage(userId);
    await deps.replaceWithStandardApplicantPostInterviewHandoffForUser(deps.navigation, userId, {
      interviewSessionId: deps.interviewSessionIdRef.current,
      source: 'pending_scoring_sync',
      attemptId,
    });
    await deps.remoteLog('[8] post_scoring_handoff', {
      via: 'pending_scoring_sync',
      attemptId,
    });
    return;
  }
  deps.setInterviewStatus('congratulations');
  await deps.remoteLog('[8] setInterviewStatus called', {
    screen: 'congratulations',
    via: 'pending_scoring_sync',
  });
}
