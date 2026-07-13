import { useEffect } from 'react';

import type { InterviewAttemptBootstrapDeps } from '@features/aria/interviewAttemptBootstrapTypes';
import { runInterviewAttemptBootstrap } from '@features/aria/runInterviewAttemptBootstrap';

export function useInterviewAttemptBootstrap(
  depsRef: React.MutableRefObject<InterviewAttemptBootstrapDeps>,
  trigger: { userId: string | undefined; isAdmin: boolean },
): void {
  useEffect(() => {
    let cancelled = false;
    void runInterviewAttemptBootstrap(depsRef.current, {
      isCancelled: () => cancelled,
    });
    return () => {
      cancelled = true;
    };
  }, [depsRef, trigger.userId, trigger.isAdmin]);
}
