import type { MutableRefObject } from 'react';

import type { InterviewAttemptBootstrap } from '@features/aria/sessionLifecycleTypes';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InterviewResponseTimingEntry } from '@utilities/persistResponseTimingsIncremental';

export type InterviewAttemptBootstrapSignal = {
  isCancelled: () => boolean;
};

export type InterviewAttemptBootstrapDeps = {
  userId: string | undefined;
  isAdmin: boolean;
  supabase: SupabaseClient;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  interviewSessionIdRef: MutableRefObject<string>;
  clearInterviewFromStorage: (userId: string) => Promise<void>;
  loadInterviewFromStorage: (userId: string) => Promise<{ sessionAttemptId?: string | null } | null>;
  setInterviewAttemptBootstrap: React.Dispatch<React.SetStateAction<InterviewAttemptBootstrap>>;
  resetSessionLogRuntime: (opts: {
    sessionCorrelationId: string;
    attemptId: string | null;
    sessionLogsRequireAttemptId: boolean;
  }) => void;
  markSessionResumedForNextRecordingStart: () => void;
  syncWebAudioRouteSessionEnvelopeFromCache: () => void;
  responseTimingsRef: MutableRefObject<InterviewResponseTimingEntry[]>;
};
