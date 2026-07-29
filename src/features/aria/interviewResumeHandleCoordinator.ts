import { remoteLog } from '@utilities/remoteLog';

const activeResumeByUserId = new Map<string, Promise<void>>();

/** Coalesce resume hydration across remounts (refs reset; this map persists for the JS runtime). */
export function runCoalescedInterviewResume(
  userId: string | undefined,
  run: () => Promise<void>,
): Promise<void> {
  if (!userId) return run();
  const existing = activeResumeByUserId.get(userId);
  if (existing) {
    void remoteLog('[REENTRY_RESUME] joined duplicate in_flight', { userId });
    return existing;
  }
  const promise = run().finally(() => {
    if (activeResumeByUserId.get(userId) === promise) {
      activeResumeByUserId.delete(userId);
    }
  });
  activeResumeByUserId.set(userId, promise);
  return promise;
}

export function isInterviewResumeHandleActive(userId: string | undefined): boolean {
  return userId != null && activeResumeByUserId.has(userId);
}

/** User tapped Begin while a stale resume guard blocked progress — allow a fresh attempt. */
export function clearInterviewResumeHandle(userId: string | undefined): void {
  if (userId) activeResumeByUserId.delete(userId);
}
