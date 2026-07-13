import { useRef } from 'react';

import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';

export function useAriaInterviewSessionProgressResetGateRefs(userId: string) {
  const interviewSessionIdRef = useRef<string>(preamble.newInterviewSessionId(userId));
  const scoreInterviewInFlightRef = useRef(false);
  const scoreInterviewAttemptedRef = useRef(false);
  const firstScenarioLifecyclePersistedRef = useRef(false);
  const consecutiveDigitalSilenceForMicFallbackRef = useRef(0);
  const micFallbackSuccessPendingRef = useRef(false);

  return {
    interviewSessionIdRef,
    scoreInterviewInFlightRef,
    scoreInterviewAttemptedRef,
    firstScenarioLifecyclePersistedRef,
    consecutiveDigitalSilenceForMicFallbackRef,
    micFallbackSuccessPendingRef,
  };
}
