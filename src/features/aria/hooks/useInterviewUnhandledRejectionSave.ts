import { useEffect } from 'react';
import { Platform } from 'react-native';

import {
  runHandleInterviewUnhandledRejection,
  type InterviewUnhandledRejectionSaveDeps,
} from '@features/aria/buildInterviewProgressSnapshotFromRefs';

export function useInterviewUnhandledRejectionSave(
  depsRef: React.MutableRefObject<InterviewUnhandledRejectionSaveDeps>,
  trigger: { userId: string | undefined },
): void {
  useEffect(() => {
    const w = Platform.OS === 'web' && typeof window !== 'undefined' ? window : null;
    if (!w) return;
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      runHandleInterviewUnhandledRejection(depsRef.current, event);
    };
    w.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => w.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, [depsRef, trigger.userId]);
}
