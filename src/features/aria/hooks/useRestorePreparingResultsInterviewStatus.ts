import { useEffect } from 'react';

import type { RestorePreparingResultsInterviewStatusDeps } from '@features/aria/checkInterviewStatusTypes';
import { runRestorePreparingResultsInterviewStatus } from '@features/aria/runRestorePreparingResultsInterviewStatus';

export function useRestorePreparingResultsInterviewStatus(
  depsRef: React.MutableRefObject<RestorePreparingResultsInterviewStatusDeps>,
  trigger: { userId: string | undefined; isAdmin: boolean },
): void {
  useEffect(() => {
    runRestorePreparingResultsInterviewStatus({
      ...depsRef.current,
      userId: trigger.userId,
      isAdmin: trigger.isAdmin,
    });
  }, [depsRef, trigger.userId, trigger.isAdmin]);
}
