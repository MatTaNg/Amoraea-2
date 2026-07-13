import type { CheckInterviewStatusDeps, CheckInterviewStatusTrigger, RestorePreparingResultsInterviewStatusDeps } from '@features/aria/checkInterviewStatusTypes';

export async function runCheckInterviewStatus(
  deps: CheckInterviewStatusDeps,
  trigger: CheckInterviewStatusTrigger,
): Promise<void> {
  const userId = trigger.userId;
  if (!userId) return;
  const { data: sessionData } = await deps.supabase.auth.getSession();
  const sessionEmail = sessionData.session?.user?.email ?? null;
  const { data, error } = await deps.supabase
    .from(deps.userInterviewRoutingTable)
    .select(deps.userInterviewPassSelect)
    .eq('id', userId)
    .maybeSingle();

  /** Session email is reliable on cold start; `user` from useAuth can be null for a frame and caused PostInterview ↔ Amoraea loops for admin. */
  const isAdminEmail = deps.isAmoraeaAdminConsoleEmail(sessionEmail ?? trigger.userEmail);
  const latestAttemptIdForRouting =
    typeof data?.latest_attempt_id === 'string' && data.latest_attempt_id.length > 0
      ? data.latest_attempt_id
      : null;
  let interviewDoneForRouting = data?.interview_completed === true;
  if (!interviewDoneForRouting) {
    interviewDoneForRouting = await deps.resolveInterviewCompletedForUser(userId, {
      interview_completed: data?.interview_completed,
      latest_attempt_id: latestAttemptIdForRouting,
    });
  }
  /** Standard applicants: hand off to neutral post-interview review (no in-app scores). */
  const shouldHandOffToPostInterview =
    trigger.isInterviewAppRoute && interviewDoneForRouting && !isAdminEmail;

  if (deps.takeInterviewJustCompletedInSession()) {
    deps.setInterviewStatus('congratulations');
    const attemptFromSession = deps.takeInterviewLastCommittedAttemptId();
    const resolvedId =
      (typeof attemptFromSession === 'string' && attemptFromSession.length > 0
        ? attemptFromSession
        : null) ?? (data?.latest_attempt_id as string | undefined);
    if (resolvedId) deps.setAnalysisAttemptId(resolvedId);
    return;
  }

  if (shouldHandOffToPostInterview) {
    const aidForHandoff = latestAttemptIdForRouting;
    if (typeof aidForHandoff === 'string' && aidForHandoff.length > 0) {
      deps.interviewStatusRef.current = 'preparing_results';
      deps.setInterviewStatus('preparing_results');
      deps.markPreparingResultsSession(userId);
      const ready = await deps.waitForInterviewAttemptScoringReady(deps.supabase, aidForHandoff, {
        maxMs: 90_000,
        intervalMs: 500,
      });
      if (ready) {
        deps.setPendingScoringSyncAttemptId(null);
        deps.clearPreparingResultsSession(userId);
        await deps.clearInterviewFromStorage(userId);
        await deps.replaceWithStandardApplicantPostInterviewHandoffForUser(deps.navigation, userId, {
          interviewSessionId: deps.interviewSessionIdRef.current,
          source: 'checkInterviewStatus_db_completed',
          attemptId: aidForHandoff,
        });
      } else {
        deps.setPendingScoringSyncAttemptId(aidForHandoff);
      }
    } else {
      await deps.clearInterviewFromStorage(userId);
      await deps.replaceWithStandardApplicantPostInterviewHandoffForUser(deps.navigation, userId, {
        interviewSessionId: deps.interviewSessionIdRef.current,
        source: 'checkInterviewStatus_db_completed_no_attempt',
      });
    }
    return;
  }

  if (
    deps.interviewStatusRef.current === 'in_progress' &&
    !deps.isInterviewCompleteRef.current &&
    !interviewDoneForRouting
  ) {
    return;
  }
  const scoringCommitInFlight =
    data != null &&
    !interviewDoneForRouting &&
    (deps.interviewStatusRef.current === 'preparing_results' ||
      deps.statusRef.current === 'scoring' ||
      deps.isInterviewCompleteRef.current ||
      deps.hasPreparingResultsSession(userId));
  if (scoringCommitInFlight) {
    return;
  }

  if (error || !data) {
    if (
      deps.interviewStatusRef.current === 'preparing_results' ||
      deps.statusRef.current === 'scoring' ||
      deps.isInterviewCompleteRef.current
    ) {
      return;
    }
    deps.setInterviewStatus('not_started');
    return;
  }

  if (!data.interview_completed && !interviewDoneForRouting) {
    deps.setPendingScoringSyncAttemptId(null);
    if (
      deps.isInterviewCompleteRef.current ||
      deps.interviewStatusRef.current === 'preparing_results' ||
      deps.statusRef.current === 'scoring'
    ) {
      return;
    }
    deps.setInterviewStatus('not_started');
  } else {
    const aid = data.latest_attempt_id as string | null | undefined;
    if (typeof aid === 'string' && aid.length > 0) {
      const { data: attemptStillThere } = await deps.supabase
        .from('interview_attempts')
        .select('id')
        .eq('id', aid)
        .maybeSingle();
      if (!attemptStillThere?.id) {
        void deps.remoteLog('[Amoraea] latest_attempt_id points at missing row after reset — not_started', {
          attemptId: aid,
        });
        deps.setPendingScoringSyncAttemptId(null);
        deps.setInterviewStatus('not_started');
        return;
      }
      deps.interviewStatusRef.current = 'preparing_results';
      deps.setInterviewStatus('preparing_results');
      deps.markPreparingResultsSession(userId);
      const ready = await deps.waitForInterviewAttemptScoringReady(deps.supabase, aid, {
        maxMs: 90_000,
        intervalMs: 500,
      });
      if (ready) {
        deps.setPendingScoringSyncAttemptId(null);
        deps.setAnalysisAttemptId(aid);
        deps.clearPreparingResultsSession(userId);
        if (shouldHandOffToPostInterview) {
          await deps.clearInterviewFromStorage(userId);
          await deps.replaceWithStandardApplicantPostInterviewHandoffForUser(deps.navigation, userId, {
            interviewSessionId: deps.interviewSessionIdRef.current,
            source: 'checkInterviewStatus_interview_done_scoring_ready',
            attemptId: aid,
          });
        } else {
          deps.setInterviewStatus('congratulations');
        }
      } else {
        deps.setPendingScoringSyncAttemptId(aid);
      }
    } else if (shouldHandOffToPostInterview) {
      await deps.clearInterviewFromStorage(userId);
      await deps.replaceWithStandardApplicantPostInterviewHandoffForUser(deps.navigation, userId, {
        interviewSessionId: deps.interviewSessionIdRef.current,
        source: 'checkInterviewStatus_interview_done_no_attempt',
      });
    } else {
      deps.setInterviewStatus('congratulations');
    }
  }
}
