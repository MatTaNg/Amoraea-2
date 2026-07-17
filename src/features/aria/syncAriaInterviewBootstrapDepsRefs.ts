import type { MutableRefObject } from 'react';

import type {
  CheckInterviewStatusDeps,
  RestorePreparingResultsInterviewStatusDeps,
} from '@features/aria/checkInterviewStatusTypes';
import type { InterviewAttemptBootstrapDeps } from '@features/aria/interviewAttemptBootstrapTypes';
import type { EnsureValidSessionDeps } from '@features/aria/runEnsureValidSession';
import type {
  InterviewAuthSignedOutSaveDeps,
  InterviewUnhandledRejectionSaveDeps,
} from '@features/aria/buildInterviewProgressSnapshotFromRefs';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsTypes';

export function syncInterviewAttemptBootstrapDeps(
  ref: MutableRefObject<InterviewAttemptBootstrapDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
    supabase: ctx.supabase,
    interviewSessionAttemptIdRef: ctx.interviewSessionAttemptIdRef,
    interviewSessionIdRef: ctx.interviewSessionIdRef,
    clearInterviewFromStorage: ctx.clearInterviewFromStorage,
    loadInterviewFromStorage: ctx.loadInterviewFromStorage,
    setInterviewAttemptBootstrap: ctx.setInterviewAttemptBootstrap,
    resetSessionLogRuntime: ctx.resetSessionLogRuntime,
    markSessionResumedForNextRecordingStart: ctx.markSessionResumedForNextRecordingStart,
    syncWebAudioRouteSessionEnvelopeFromCache: ctx.syncWebAudioRouteSessionEnvelopeFromCache,
    responseTimingsRef: ctx.responseTimingsRef,
  } as InterviewAttemptBootstrapDeps;
}

export function syncEnsureValidSessionDeps(
  ref: MutableRefObject<EnsureValidSessionDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    supabase: ctx.supabase,
  } as EnsureValidSessionDeps;
}

export function syncInterviewUnhandledRejectionSaveDeps(
  ref: MutableRefObject<InterviewUnhandledRejectionSaveDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userId: ctx.userId,
    statusRef: ctx.statusRef,
    currentMessagesRef: ctx.currentMessagesRef,
    scoredScenariosRef: ctx.scoredScenariosRef,
    scenarioScoresRef: ctx.scenarioScoresRef,
    currentScenarioRef: ctx.currentScenarioRef,
    resumeActiveScenarioRef: ctx.resumeActiveScenarioRef,
    saveInterviewProgress: ctx.saveInterviewProgress,
  } as InterviewUnhandledRejectionSaveDeps;
}

export function syncInterviewAuthSignedOutSaveDeps(
  ref: MutableRefObject<InterviewAuthSignedOutSaveDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userId: ctx.userId,
    supabase: ctx.supabase,
    currentMessagesRef: ctx.currentMessagesRef,
    scoredScenariosRef: ctx.scoredScenariosRef,
    scenarioScoresRef: ctx.scenarioScoresRef,
    currentScenarioRef: ctx.currentScenarioRef,
    resumeActiveScenarioRef: ctx.resumeActiveScenarioRef,
    saveInterviewProgress: ctx.saveInterviewProgress,
    setSessionExpired: ctx.setSessionExpired,
  } as InterviewAuthSignedOutSaveDeps;
}

export function syncRestorePreparingResultsInterviewStatusDeps(
  ref: MutableRefObject<RestorePreparingResultsInterviewStatusDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
    hasPreparingResultsSession: ctx.hasPreparingResultsSession,
    isInterviewCompleteRef: ctx.isInterviewCompleteRef,
    interviewStatusRef: ctx.interviewStatusRef,
    setInterviewStatus: ctx.setInterviewStatus,
  } as RestorePreparingResultsInterviewStatusDeps;
}

export function syncCheckInterviewStatusDeps(
  ref: MutableRefObject<CheckInterviewStatusDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    supabase: ctx.supabase,
    navigation: ctx.navigation,
    interviewStatusRef: ctx.interviewStatusRef,
    isInterviewCompleteRef: ctx.isInterviewCompleteRef,
    statusRef: ctx.statusRef,
    interviewSessionIdRef: ctx.interviewSessionIdRef,
    userInterviewRoutingTable: ctx.userInterviewRoutingTable,
    userInterviewPassSelect: ctx.userInterviewPassSelect,
    isAmoraeaAdminConsoleEmail: ctx.isAmoraeaAdminConsoleEmail,
    resolveInterviewCompletedForUser: ctx.resolveInterviewCompletedForUser,
    takeInterviewJustCompletedInSession: ctx.takeInterviewJustCompletedInSession,
    takeInterviewLastCommittedAttemptId: ctx.takeInterviewLastCommittedAttemptId,
    hasPreparingResultsSession: ctx.hasPreparingResultsSession,
    markPreparingResultsSession: ctx.markPreparingResultsSession,
    clearPreparingResultsSession: ctx.clearPreparingResultsSession,
    waitForInterviewAttemptScoringReady: ctx.waitForInterviewAttemptScoringReady,
    clearInterviewFromStorage: ctx.clearInterviewFromStorage,
    replaceWithStandardApplicantPostInterviewHandoffForUser:
      ctx.replaceWithStandardApplicantPostInterviewHandoffForUser,
    setInterviewStatus: ctx.setInterviewStatus,
    setAnalysisAttemptId: ctx.setAnalysisAttemptId,
    setPendingScoringSyncAttemptId: ctx.setPendingScoringSyncAttemptId,
    remoteLog: ctx.remoteLog,
  } as CheckInterviewStatusDeps;
}
