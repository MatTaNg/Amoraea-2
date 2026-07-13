import { useEffect } from 'react';

import type {
  LoadStandardResultsReferralCodeDeps,
  LoadStandardResultsReferralCodeTrigger,
} from '@features/aria/interviewPostScoringEffectsTypes';
import { runLoadStandardResultsReferralCode } from '@features/aria/runLoadStandardResultsReferralCode';

export function useLoadStandardResultsReferralCode(
  depsRef: React.MutableRefObject<LoadStandardResultsReferralCodeDeps>,
  trigger: LoadStandardResultsReferralCodeTrigger,
): void {
  useEffect(() => {
    let cancelled = false;
    void runLoadStandardResultsReferralCode(depsRef.current, trigger, {
      isCancelled: () => cancelled,
    });
    return () => {
      cancelled = true;
    };
  }, [depsRef, trigger.status, trigger.userId, trigger.userEmail, trigger.isAdmin]);
}
