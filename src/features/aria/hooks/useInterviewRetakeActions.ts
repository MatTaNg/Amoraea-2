import { useCallback } from 'react';

import {
  runConfirmAdminInterviewReset,
  runConfirmInterviewRetake,
} from '@features/aria/interviewConfirmDialogActions';
import { runPerformAdminInterviewReset } from '@features/aria/runPerformAdminInterviewReset';
import type { PerformAdminInterviewResetDeps } from '@features/aria/performAdminInterviewResetTypes';
import { runPerformInterviewRetake } from '@features/aria/runPerformInterviewRetake';
import type { PerformInterviewRetakeDeps } from '@features/aria/performInterviewRetakeTypes';
import type { ShowInterviewConfirmDialog } from '@features/aria/interviewConfirmDialogActions';

export function useInterviewRetakeActions(deps: {
  performRetakeDepsRef: React.MutableRefObject<PerformInterviewRetakeDeps>;
  showConfirmDialog: ShowInterviewConfirmDialog;
}) {
  const performRetake = useCallback(async () => {
    await runPerformInterviewRetake(deps.performRetakeDepsRef.current);
  }, [deps.performRetakeDepsRef]);

  const handleRetake = useCallback(() => {
    runConfirmInterviewRetake({ showConfirmDialog: deps.showConfirmDialog, performRetake });
  }, [deps.showConfirmDialog, performRetake]);

  return { performRetake, handleRetake };
}

export function useInterviewAdminResetActions(deps: {
  performAdminInterviewResetDepsRef: React.MutableRefObject<PerformAdminInterviewResetDeps>;
  showConfirmDialog: ShowInterviewConfirmDialog;
}) {
  const performAdminInterviewReset = useCallback(async () => {
    await runPerformAdminInterviewReset(deps.performAdminInterviewResetDepsRef.current);
  }, [deps.performAdminInterviewResetDepsRef]);

  const handleAdminResetInterview = useCallback(() => {
    runConfirmAdminInterviewReset({
      showConfirmDialog: deps.showConfirmDialog,
      performAdminInterviewReset,
    });
  }, [deps.showConfirmDialog, performAdminInterviewReset]);

  return { performAdminInterviewReset, handleAdminResetInterview };
}
