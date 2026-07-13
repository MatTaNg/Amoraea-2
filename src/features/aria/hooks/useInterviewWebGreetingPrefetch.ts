import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { InterviewWebGreetingPrefetchDeps } from '@features/aria/runPrefetchWebInterviewGreetingOnConsent';
import { runPrefetchWebInterviewGreetingOnConsent } from '@features/aria/runPrefetchWebInterviewGreetingOnConsent';

export function useInterviewWebGreetingPrefetch(
  depsRef: React.MutableRefObject<InterviewWebGreetingPrefetchDeps>,
  trigger: {
    status: string;
    preInterviewConsentAge: boolean;
    preInterviewConsentData: boolean;
  },
): void {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (trigger.status !== 'intro') return;
    if (!trigger.preInterviewConsentAge || !trigger.preInterviewConsentData) return;
    let cancelled = false;
    void runPrefetchWebInterviewGreetingOnConsent(depsRef.current, {
      isCancelled: () => cancelled,
    });
    return () => {
      cancelled = true;
    };
  }, [
    depsRef,
    trigger.status,
    trigger.preInterviewConsentAge,
    trigger.preInterviewConsentData,
  ]);
}
