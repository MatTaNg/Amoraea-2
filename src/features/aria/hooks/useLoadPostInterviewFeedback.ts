import { useEffect } from 'react';

import type { LoadPostInterviewFeedbackDeps } from '@features/aria/loadPostInterviewFeedbackTypes';
import { runLoadPostInterviewFeedback } from '@features/aria/runLoadPostInterviewFeedback';

export function useLoadPostInterviewFeedback(
  depsRef: React.MutableRefObject<LoadPostInterviewFeedbackDeps>,
  trigger: {
    userId: string | undefined;
    interviewStatus: string;
    analysisAttemptId: string | null;
  },
): void {
  useEffect(() => {
    let cancelled = false;
    void runLoadPostInterviewFeedback(depsRef.current, {
      isCancelled: () => cancelled,
    });
    return () => {
      cancelled = true;
    };
  }, [depsRef, trigger.userId, trigger.interviewStatus, trigger.analysisAttemptId]);
}
