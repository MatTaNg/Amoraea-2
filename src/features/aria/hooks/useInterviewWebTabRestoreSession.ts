import { useCallback } from 'react';

import {
  runAttemptMobileWebHtmlTabResumeAfterScreenReturn,
  runHandleWebTabGestureRestoreTap,
  runSyncInterviewTtsAfterScreenReturn,
} from '@features/aria/runInterviewWebTabRestoreSession';
import type { InterviewWebTabRestoreSessionDeps } from '@features/aria/webTabRestoreSessionDeps';

export type { InterviewWebTabRestoreSessionDeps };

export function useInterviewWebTabRestoreSession(
  depsRef: React.MutableRefObject<InterviewWebTabRestoreSessionDeps>,
) {
  const attemptMobileWebHtmlTabResumeAfterScreenReturn = useCallback((): boolean => {
    return runAttemptMobileWebHtmlTabResumeAfterScreenReturn(depsRef.current);
  }, [depsRef]);

  const syncInterviewTtsAfterScreenReturn = useCallback((): void => {
    runSyncInterviewTtsAfterScreenReturn(depsRef.current);
  }, [depsRef]);

  const handleWebTabGestureRestoreTap = useCallback(async (): Promise<void> => {
    await runHandleWebTabGestureRestoreTap(depsRef.current);
  }, [depsRef]);

  return {
    attemptMobileWebHtmlTabResumeAfterScreenReturn,
    syncInterviewTtsAfterScreenReturn,
    handleWebTabGestureRestoreTap,
  };
}
