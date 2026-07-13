import { useEffect } from 'react';

import type { CheckInterviewStatusDeps, CheckInterviewStatusTrigger } from '@features/aria/checkInterviewStatusTypes';
import { runCheckInterviewStatus } from '@features/aria/runCheckInterviewStatus';

export function useCheckInterviewStatus(
  depsRef: React.MutableRefObject<CheckInterviewStatusDeps>,
  trigger: CheckInterviewStatusTrigger,
): void {
  useEffect(() => {
    void runCheckInterviewStatus(depsRef.current, trigger);
  }, [
    depsRef,
    trigger.userId,
    trigger.userEmail,
    trigger.isInterviewAppRoute,
    trigger.preparingHandoffPollTick,
  ]);
}
