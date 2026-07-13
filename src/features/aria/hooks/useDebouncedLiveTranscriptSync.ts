import { useEffect } from 'react';

import {
  LIVE_TRANSCRIPT_SYNC_DEBOUNCE_MS,
  runDebouncedLiveTranscriptSync,
  type DebouncedLiveTranscriptSyncDeps,
  type DebouncedLiveTranscriptSyncTrigger,
} from '@features/aria/interviewActivePersistenceTypes';

/** Debounced sync of live transcript to the active `interview_attempts` row for admin follow-along. */
export function useDebouncedLiveTranscriptSync(
  depsRef: React.MutableRefObject<DebouncedLiveTranscriptSyncDeps>,
  trigger: DebouncedLiveTranscriptSyncTrigger,
): void {
  useEffect(() => {
    if (!trigger.userId || trigger.isAdmin || trigger.status !== 'active') return;
    if (trigger.messages.length === 0) return;
    if (!depsRef.current.interviewSessionAttemptIdRef.current) return;
    const t = setTimeout(() => {
      runDebouncedLiveTranscriptSync(depsRef.current, trigger);
    }, LIVE_TRANSCRIPT_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [
    depsRef,
    trigger.userId,
    trigger.isAdmin,
    trigger.status,
    trigger.interviewStatus,
    trigger.messages,
  ]);
}
