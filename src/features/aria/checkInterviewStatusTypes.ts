import type { MutableRefObject } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

export type CheckInterviewStatusTrigger = {
  userId: string | undefined;
  userEmail: string | null | undefined;
  isInterviewAppRoute: boolean;
  preparingHandoffPollTick: number;
};

export type CheckInterviewStatusDeps = {
  supabase: SupabaseClient;
  navigation: {
    replace?: (route: string, params?: unknown) => void;
    navigate?: (route: string, params?: unknown) => void;
  };
  interviewStatusRef: MutableRefObject<string>;
  isInterviewCompleteRef: MutableRefObject<boolean>;
  statusRef: MutableRefObject<string>;
  interviewSessionIdRef: MutableRefObject<string>;
  userInterviewRoutingTable: string;
  userInterviewPassSelect: string;
  isAmoraeaAdminConsoleEmail: (email: string | null | undefined) => boolean;
  resolveInterviewCompletedForUser: (
    userId: string,
    routing: { interview_completed?: boolean | null; latest_attempt_id?: string | null },
  ) => Promise<boolean>;
  takeInterviewJustCompletedInSession: () => boolean;
  takeInterviewLastCommittedAttemptId: () => string | null;
  hasPreparingResultsSession: (userId: string) => boolean;
  markPreparingResultsSession: (userId: string) => void;
  clearPreparingResultsSession: (userId: string) => void;
  waitForInterviewAttemptScoringReady: (
    supabase: SupabaseClient,
    attemptId: string,
    opts: { maxMs: number; intervalMs: number },
  ) => Promise<boolean>;
  clearInterviewFromStorage: (userId: string) => Promise<void>;
  replaceWithStandardApplicantPostInterviewHandoffForUser: (
    navigation: CheckInterviewStatusDeps['navigation'],
    userId: string,
    opts: {
      interviewSessionId: string;
      source: string;
      attemptId?: string;
    },
  ) => void | Promise<void>;
  setInterviewStatus: React.Dispatch<
    React.SetStateAction<
      | 'loading'
      | 'not_started'
      | 'in_progress'
      | 'preparing_results'
      | 'under_review'
      | 'congratulations'
      | 'analysis'
    >
  >;
  setAnalysisAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
  setPendingScoringSyncAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
  remoteLog: (message: string, data?: Record<string, unknown>) => void | Promise<void>;
};

export type RestorePreparingResultsInterviewStatusDeps = {
  userId: string | undefined;
  isAdmin: boolean;
  hasPreparingResultsSession: (userId: string) => boolean;
  isInterviewCompleteRef: MutableRefObject<boolean>;
  interviewStatusRef: MutableRefObject<string>;
  setInterviewStatus: CheckInterviewStatusDeps['setInterviewStatus'];
};
