import { useEffect, useRef } from 'react';

import type { InterviewAttemptBootstrapDeps } from '@features/aria/interviewAttemptBootstrapTypes';
import { runInterviewAttemptBootstrap } from '@features/aria/runInterviewAttemptBootstrap';

const INTERVIEW_ATTEMPT_BOOTSTRAP_WATCHDOG_MS = 12_000;

export function useInterviewAttemptBootstrap(
  depsRef: React.MutableRefObject<InterviewAttemptBootstrapDeps>,
  trigger: { userId: string | undefined; isAdmin: boolean },
): void {
  const bootstrapStateRef = useRef(depsRef.current.setInterviewAttemptBootstrap);

  useEffect(() => {
    bootstrapStateRef.current = depsRef.current.setInterviewAttemptBootstrap;
  });

  useEffect(() => {
    let cancelled = false;
    const watchdog = setTimeout(() => {
      if (cancelled) return;
      bootstrapStateRef.current((prev) => {
        if (prev === 'loading' || prev === 'idle') {
          if (__DEV__) {
            console.warn('[BOOT] attempt bootstrap watchdog — unblocking begin');
          }
          return 'ready';
        }
        return prev;
      });
    }, INTERVIEW_ATTEMPT_BOOTSTRAP_WATCHDOG_MS);

    void runInterviewAttemptBootstrap(depsRef.current, {
      isCancelled: () => cancelled,
    });

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
    };
  }, [depsRef, trigger.userId, trigger.isAdmin]);
}
