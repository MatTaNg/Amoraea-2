import { useEffect } from 'react';

import type { PendingScoringSyncPollDeps, PendingScoringSyncPollTrigger } from '@features/aria/interviewPostScoringEffectsTypes';
import { runPendingScoringSyncPoll } from '@features/aria/runPendingScoringSyncPoll';

export function usePendingScoringSyncPoll(
  depsRef: React.MutableRefObject<PendingScoringSyncPollDeps>,
  trigger: PendingScoringSyncPollTrigger,
): void {
  useEffect(() => {
    let cancelled = false;
    void runPendingScoringSyncPoll(depsRef.current, trigger, {
      isCancelled: () => cancelled,
    });
    return () => {
      cancelled = true;
    };
  }, [
    depsRef,
    trigger.pendingScoringSyncAttemptId,
    trigger.userId,
    trigger.userEmail,
    trigger.isInterviewAppRoute,
  ]);
}
