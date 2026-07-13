import type { InterviewLoadingStatusFailsafeDeps } from '@features/aria/interviewPostScoringEffectsTypes';

const INTERVIEW_LOADING_STATUS_FAILSAFE_MS = 5000;

/** Failsafe: never stay on "Loading..." forever (e.g. slow auth in incognito). */
export async function runInterviewLoadingStatusFailsafe(
  deps: InterviewLoadingStatusFailsafeDeps,
): Promise<void> {
  if (deps.interviewStatusRef.current !== 'loading') return;
  if (!deps.userId || deps.isAdmin) {
    deps.setInterviewStatus('not_started');
    return;
  }
  const { data: routingRow } = await deps.supabase
    .from(deps.userInterviewRoutingTable)
    .select('interview_completed, latest_attempt_id')
    .eq('id', deps.userId)
    .maybeSingle();
  let interviewDoneForRouting = routingRow?.interview_completed === true;
  const latestAttemptId =
    typeof routingRow?.latest_attempt_id === 'string' && routingRow.latest_attempt_id.length > 0
      ? routingRow.latest_attempt_id
      : null;
  if (!interviewDoneForRouting && latestAttemptId) {
    const { data: latestAttemptMeta } = await deps.supabase
      .from('interview_attempts')
      .select('completed_at')
      .eq('id', latestAttemptId)
      .eq('user_id', deps.userId)
      .maybeSingle();
    interviewDoneForRouting = !!latestAttemptMeta?.completed_at;
  }
  if (interviewDoneForRouting) {
    return;
  }
  if (deps.interviewStatusRef.current === 'loading') {
    deps.setInterviewStatus('not_started');
  }
}

export { INTERVIEW_LOADING_STATUS_FAILSAFE_MS };
