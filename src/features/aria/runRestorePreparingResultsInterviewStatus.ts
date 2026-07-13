import type { RestorePreparingResultsInterviewStatusDeps } from '@features/aria/checkInterviewStatusTypes';

/** Restore preparing UI before `checkInterviewStatus` can fall through to `not_started` after remount. */
export function runRestorePreparingResultsInterviewStatus(
  deps: RestorePreparingResultsInterviewStatusDeps,
): void {
  if (!deps.userId || deps.isAdmin) return;
  if (!deps.hasPreparingResultsSession(deps.userId)) return;
  deps.isInterviewCompleteRef.current = true;
  if (deps.interviewStatusRef.current !== 'congratulations') {
    deps.interviewStatusRef.current = 'preparing_results';
    deps.setInterviewStatus('preparing_results');
  }
}
