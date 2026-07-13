import { useEffect } from 'react';

import type { InterviewLoadingStatusFailsafeDeps } from '@features/aria/interviewPostScoringEffectsTypes';
import {
  INTERVIEW_LOADING_STATUS_FAILSAFE_MS,
  runInterviewLoadingStatusFailsafe,
} from '@features/aria/runInterviewLoadingStatusFailsafe';

export function useInterviewLoadingStatusFailsafe(
  depsRef: React.MutableRefObject<InterviewLoadingStatusFailsafeDeps>,
  trigger: { userId: string | undefined; isAdmin: boolean },
): void {
  useEffect(() => {
    const t = setTimeout(() => {
      void runInterviewLoadingStatusFailsafe({
        ...depsRef.current,
        userId: trigger.userId,
        isAdmin: trigger.isAdmin,
      });
    }, INTERVIEW_LOADING_STATUS_FAILSAFE_MS);
    return () => clearTimeout(t);
  }, [depsRef, trigger.userId, trigger.isAdmin]);
}
