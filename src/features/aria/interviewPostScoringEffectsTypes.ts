import type { MutableRefObject } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

export type PendingScoringSyncPollTrigger = {
  pendingScoringSyncAttemptId: string | null;
  userId: string | undefined;
  userEmail: string | null | undefined;
  isInterviewAppRoute: boolean;
};

export type PendingScoringSyncPollSignal = {
  isCancelled: () => boolean;
};

export type PendingScoringSyncPollDeps = {
  supabase: SupabaseClient;
  navigation: {
    replace?: (route: string, params?: unknown) => void;
    navigate?: (route: string, params?: unknown) => void;
  };
  interviewSessionIdRef: MutableRefObject<string>;
  waitForInterviewAttemptScoringReady: (
    supabase: SupabaseClient,
    attemptId: string,
    opts: { maxMs: number; intervalMs: number },
  ) => Promise<boolean>;
  setPendingScoringSyncAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
  setAnalysisAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
  clearPreparingResultsSession: (userId: string) => void;
  runCommunicationStylePipelineAfterSave: (
    userId: string,
    attemptId: string,
    interviewSessionId: string,
    opts: { platform: string },
  ) => Promise<void>;
  getSessionLogRuntime: () => { platform: string; attemptId: string | null };
  resolveStandardPostInterviewHandoffEligible: (
    userId: string,
    opts: {
      isInterviewAppRoute: boolean;
      sessionEmail: string | null;
      profileEmail: string | null | undefined;
    },
  ) => Promise<{ shouldHandOff: boolean }>;
  isValidationTrackInterviewHandoffActive: () => boolean;
  clearInterviewFromStorage: (userId: string) => Promise<void>;
  replaceWithStandardApplicantPostInterviewHandoffForUser: (
    navigation: PendingScoringSyncPollDeps['navigation'],
    userId: string,
    opts: {
      interviewSessionId: string;
      source: string;
      attemptId: string;
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
  remoteLog: (message: string, data?: Record<string, unknown>) => void | Promise<void>;
};

export type InterviewLoadingStatusFailsafeDeps = {
  userId: string | undefined;
  isAdmin: boolean;
  supabase: SupabaseClient;
  interviewStatusRef: MutableRefObject<string>;
  userInterviewRoutingTable: string;
  setInterviewStatus: PendingScoringSyncPollDeps['setInterviewStatus'];
};

export type AlphaModeCongratulationsFailsafeTrigger = {
  alphaMode: boolean;
  userId: string | undefined;
  status: string;
  interviewStatus: string;
  hasResults: boolean;
};

export type AlphaModeCongratulationsFailsafeDeps = {
  clearPreparingResultsSession: (userId: string) => void;
  setInterviewStatus: PendingScoringSyncPollDeps['setInterviewStatus'];
};

export type LoadStandardResultsReferralCodeTrigger = {
  status: string;
  userId: string | undefined;
  userEmail: string | null | undefined;
  isAdmin: boolean;
};

export type LoadStandardResultsReferralCodeDeps = {
  supabase: SupabaseClient;
  isAmoraeaAdminConsoleEmail: (email: string | null | undefined) => boolean;
  setStandardResultsReferralCode: React.Dispatch<React.SetStateAction<string | null>>;
};

export type RecoverPendingDatabaseSaveTrigger = {
  userId: string | undefined;
  isAdmin: boolean;
};

export type RecoverPendingDatabaseSaveDeps = {
  supabase: SupabaseClient;
  interviewSessionIdRef: MutableRefObject<string>;
  loadInterviewFromStorage: (userId: string) => Promise<Record<string, unknown> | null>;
  saveInterviewProgress: (userId: string, data: Record<string, unknown>) => Promise<void>;
  ensureValidSession: () => Promise<void>;
  runCommunicationStylePipelineAfterSave: PendingScoringSyncPollDeps['runCommunicationStylePipelineAfterSave'];
  getSessionLogRuntime: PendingScoringSyncPollDeps['getSessionLogRuntime'];
};

type PendingAttemptPayload = {
  insert: Record<string, unknown>;
  update: Record<string, unknown>;
  attemptNum: number;
};

export async function runRecoverPendingDatabaseSave(
  deps: RecoverPendingDatabaseSaveDeps,
  trigger: RecoverPendingDatabaseSaveTrigger,
): Promise<void> {
  if (!trigger.userId || trigger.isAdmin) return;
  const saved = await deps.loadInterviewFromStorage(trigger.userId);
  const payload = saved?.pendingAttemptPayload as PendingAttemptPayload | undefined;
  if (!saved?.pendingDatabaseSave || !payload?.insert) return;
  try {
    await deps.ensureValidSession();
    const { data: insertData, error: insertErr } = await deps.supabase
      .from('interview_attempts')
      .insert(payload.insert)
      .select('id')
      .single();
    if (insertErr) throw new Error(insertErr.message);
    const update = { ...payload.update, latest_attempt_id: insertData?.id ?? null };
    const { error: updateErr } = await deps.supabase
      .from('users')
      .update(update)
      .eq('id', trigger.userId);
    if (updateErr) throw new Error(updateErr.message);
    const recoveredAttemptId = insertData?.id;
    if (recoveredAttemptId) {
      await deps.runCommunicationStylePipelineAfterSave(
        trigger.userId,
        recoveredAttemptId,
        deps.interviewSessionIdRef.current,
        {
          platform: deps.getSessionLogRuntime().platform,
        },
      );
    }
    const next = { ...saved };
    delete next.pendingDatabaseSave;
    delete next.saveFailedAt;
    delete next.pendingAttemptPayload;
    await deps.saveInterviewProgress(trigger.userId, next);
  } catch (err) {
    if (__DEV__) console.warn('Recovery save still failing:', err instanceof Error ? err.message : err);
  }
}
