import { useEffect } from 'react';
import { runInterviewAttemptEgoRepairFromLatestAttempt } from '@utilities/interviewAttemptEgoRepairCoordinator';

/**
 * Re-persists `ego_development_level` when the latest completed attempt row is missing ego (interrupt / RLS).
 * Runs from Amoraea and from post-interview stack screens — applicants navigate off Amoraea before this repair would run there alone.
 */
export function useInterviewAttemptEgoRepair(opts: {
  userId: string;
  isAdmin: boolean;
  typologyContext?: string;
  sourceScreen: string;
  enabled?: boolean;
}): void {
  const { userId, isAdmin, typologyContext = '', sourceScreen, enabled = true } = opts;
  useEffect(() => {
    if (!enabled || !userId || isAdmin) return;
    const ac = new AbortController();
    void runInterviewAttemptEgoRepairFromLatestAttempt({
      userId,
      isAdmin,
      typologyContext,
      sourceScreen,
      signal: ac.signal,
    });
    return () => ac.abort();
  }, [userId, isAdmin, typologyContext, sourceScreen, enabled]);
}
