import { useEffect } from 'react';

import {
  runRecoverPendingDatabaseSave,
  type RecoverPendingDatabaseSaveDeps,
  type RecoverPendingDatabaseSaveTrigger,
} from '@features/aria/interviewPostScoringEffectsTypes';

export function useRecoverPendingDatabaseSave(
  depsRef: React.MutableRefObject<RecoverPendingDatabaseSaveDeps>,
  trigger: RecoverPendingDatabaseSaveTrigger,
): void {
  useEffect(() => {
    void runRecoverPendingDatabaseSave(depsRef.current, trigger);
  }, [depsRef, trigger.userId, trigger.isAdmin]);
}
