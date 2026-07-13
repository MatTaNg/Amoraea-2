import type { MutableRefObject } from 'react';

import type {
  PendingScoringSyncPollDeps,
  InterviewLoadingStatusFailsafeDeps,
  AlphaModeCongratulationsFailsafeDeps,
  LoadStandardResultsReferralCodeDeps,
  RecoverPendingDatabaseSaveDeps,
} from '@features/aria/interviewPostScoringEffectsTypes';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsTypes';

export function syncPendingScoringSyncPollDeps(
  ref: MutableRefObject<PendingScoringSyncPollDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    supabase: ctx.supabase,
    navigation: ctx.navigation,
    interviewSessionIdRef: ctx.interviewSessionIdRef,
    waitForInterviewAttemptScoringReady: ctx.waitForInterviewAttemptScoringReady,
    setPendingScoringSyncAttemptId: ctx.setPendingScoringSyncAttemptId,
    setAnalysisAttemptId: ctx.setAnalysisAttemptId,
    clearPreparingResultsSession: ctx.clearPreparingResultsSession,
    runCommunicationStylePipelineAfterSave: ctx.runCommunicationStylePipelineAfterSave,
    getSessionLogRuntime: ctx.getSessionLogRuntime,
    resolveStandardPostInterviewHandoffEligible: ctx.resolveStandardPostInterviewHandoffEligible,
    isValidationTrackInterviewHandoffActive: ctx.isValidationTrackInterviewHandoffActive,
    clearInterviewFromStorage: ctx.clearInterviewFromStorage,
    replaceWithStandardApplicantPostInterviewHandoffForUser:
      ctx.replaceWithStandardApplicantPostInterviewHandoffForUser,
    setInterviewStatus: ctx.setInterviewStatus,
    remoteLog: ctx.remoteLog,
  } as PendingScoringSyncPollDeps;
}

export function syncInterviewLoadingStatusFailsafeDeps(
  ref: MutableRefObject<InterviewLoadingStatusFailsafeDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
    supabase: ctx.supabase,
    interviewStatusRef: ctx.interviewStatusRef,
    userInterviewRoutingTable: ctx.userInterviewRoutingTable,
    setInterviewStatus: ctx.setInterviewStatus,
  } as InterviewLoadingStatusFailsafeDeps;
}

export function syncAlphaModeCongratulationsFailsafeDeps(
  ref: MutableRefObject<AlphaModeCongratulationsFailsafeDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    clearPreparingResultsSession: ctx.clearPreparingResultsSession,
    setInterviewStatus: ctx.setInterviewStatus,
  } as AlphaModeCongratulationsFailsafeDeps;
}

export function syncLoadStandardResultsReferralCodeDeps(
  ref: MutableRefObject<LoadStandardResultsReferralCodeDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    supabase: ctx.supabase,
    isAmoraeaAdminConsoleEmail: ctx.isAmoraeaAdminConsoleEmail,
    setStandardResultsReferralCode: ctx.setStandardResultsReferralCode,
  } as LoadStandardResultsReferralCodeDeps;
}

export function syncRecoverPendingDatabaseSaveDeps(
  ref: MutableRefObject<RecoverPendingDatabaseSaveDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    supabase: ctx.supabase,
    interviewSessionIdRef: ctx.interviewSessionIdRef,
    loadInterviewFromStorage: ctx.loadInterviewFromStorage,
    saveInterviewProgress: ctx.saveInterviewProgress,
    ensureValidSession: ctx.ensureValidSession,
    runCommunicationStylePipelineAfterSave: ctx.runCommunicationStylePipelineAfterSave,
    getSessionLogRuntime: ctx.getSessionLogRuntime,
  } as RecoverPendingDatabaseSaveDeps;
}
