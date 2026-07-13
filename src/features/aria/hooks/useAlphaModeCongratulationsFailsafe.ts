import { useEffect } from 'react';

import type {
  AlphaModeCongratulationsFailsafeDeps,
  AlphaModeCongratulationsFailsafeTrigger,
} from '@features/aria/interviewPostScoringEffectsTypes';
import { runAlphaModeCongratulationsFailsafe } from '@features/aria/runAlphaModeCongratulationsFailsafe';

export function useAlphaModeCongratulationsFailsafe(
  depsRef: React.MutableRefObject<AlphaModeCongratulationsFailsafeDeps>,
  trigger: AlphaModeCongratulationsFailsafeTrigger,
): void {
  useEffect(() => {
    runAlphaModeCongratulationsFailsafe(depsRef.current, trigger);
  }, [
    depsRef,
    trigger.alphaMode,
    trigger.userId,
    trigger.status,
    trigger.interviewStatus,
    trigger.hasResults,
  ]);
}
