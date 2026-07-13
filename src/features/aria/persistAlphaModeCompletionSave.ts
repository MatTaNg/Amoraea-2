import type { SupabaseClient } from '@supabase/supabase-js';

import type { GateResult } from '@features/aria/computeGateResult';
import { setInterviewJustCompletedInSession } from '@features/aria/interviewSessionGlobals';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import { commitStandardOnboardingUsersAfterAttempt } from '@features/aria/scoreInterviewOnboardingCommit';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import { resolveAttemptNumberForCompletion } from '@features/interview/interviewAttemptLifecycle';
import { applyPsychometricModifierToAttempt } from '@features/psychometrics/applyPsychometricModifier';
import { buildUsersRowInterviewPassFromGate } from '@utilities/interviewPassEffective';
import { remoteLog } from '@utilities/remoteLog';
import { runCommunicationStylePipelineAfterSave } from '@utilities/runCommunicationStylePipeline';
import {
  assignAttemptIdForSessionLogs,
  getSessionLogRuntime,
  logGateAnalyticsToSession,
  writeSessionLog,
} from '@utilities/sessionLogging';
import { clearInterviewFromStorage } from '@utilities/storage/InterviewStorage';
import { waitForInterviewAttemptScoringReady } from '@utilities/waitForInterviewAttemptScoringReady';
import { withRetry } from '@utilities/withRetry';

export async function buildAlphaModeUsersUpdatePayload(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  finalGateResult: GateResult,
  attemptNum: number,
): Promise<Record<string, unknown>> {
  const passFromGate = await buildUsersRowInterviewPassFromGate(supabase, userId, finalGateResult.pass);
  return {
    interview_completed: true,
    ...passFromGate,
    interview_completed_at: new Date().toISOString(),
    interview_attempt_count: attemptNum,
    latest_attempt_id: null as string | null,
  };
}

export async function persistAlphaModeCompletionSave(params: {
  deps: ScoreInterviewDeps;
  supabase: SupabaseClient;
  insertPayload: Record<string, unknown>;
  updatePayload: Record<string, unknown>;
  finalGateResult: GateResult;
  pillarScores: Record<string, number>;
  parsed: InterviewResults;
  attemptNum: number;
  existingAttemptId: string | null;
  isStandardOnboardingApplicant: boolean;
  gateBlockedAlpha: boolean;
  disclosureCalibrationForAttempt: string;
}): Promise<string | null> {
  const {
    deps,
    supabase,
    insertPayload,
    updatePayload,
    finalGateResult,
    pillarScores,
    parsed,
    attemptNum,
    existingAttemptId,
    isStandardOnboardingApplicant,
    gateBlockedAlpha,
    disclosureCalibrationForAttempt,
  } = params;

  const slBase = {
    userId: deps.userId,
    attemptId: getSessionLogRuntime().attemptId,
    platform: getSessionLogRuntime().platform,
  };

  console.log('[Disclosure] persisting disclosure_calibration:', disclosureCalibrationForAttempt);
  const { data: insertData } = await withRetry(
    async () => {
      if (existingAttemptId) {
        const { error: upErr } = await supabase
          .from('interview_attempts')
          .update(insertPayload)
          .eq('id', existingAttemptId)
          .eq('user_id', deps.userId);
        if (upErr) throw new Error(upErr.message);
        return { data: { id: existingAttemptId }, error: null };
      }
      const result = await supabase.from('interview_attempts').insert(insertPayload).select('id').single();
      if (result.error) throw new Error(result.error.message);
      return result;
    },
    {
      retries: 3,
      baseDelay: 3000,
      maxDelay: 15000,
      context: 'database interview_attempts insert',
      sessionLog: deps.userId ? slBase : undefined,
    },
  );

  updatePayload.latest_attempt_id = insertData?.id ?? null;
  await withRetry(
    async () => {
      const { error } = await supabase.from('users').update(updatePayload).eq('id', deps.userId);
      if (error) throw new Error(error.message);
    },
    {
      retries: 3,
      baseDelay: 3000,
      maxDelay: 15000,
      context: 'database users update',
      sessionLog: deps.userId ? slBase : undefined,
    },
  );

  await clearInterviewFromStorage(deps.userId);
  const attemptId = insertData?.id ?? null;
  await remoteLog('[5] Database save result', {
    attemptId: attemptId ?? null,
    error: null,
    errorCode: null,
  });
  if (__DEV__) {
    console.log('=== [5] DB save ===', { id: attemptId ?? undefined, error: null });
  }

  if (attemptId) {
    deps.setInterviewLastCommittedAttemptId(attemptId);
    assignAttemptIdForSessionLogs(attemptId);
    await applyPsychometricModifierToAttempt(deps.userId, attemptId);
    const rtp = getSessionLogRuntime();
    logGateAnalyticsToSession({
      base: { userId: deps.userId, attemptId: rtp.attemptId, platform: rtp.platform },
      gateReason: finalGateResult.reason,
      failingConstruct: finalGateResult.failingConstruct,
      failingScore: finalGateResult.failingScore,
      weightedScore: finalGateResult.weightedScore,
      pillarScores,
    });
    void runCommunicationStylePipelineAfterSave(
      deps.userId,
      attemptId,
      deps.interviewSessionIdRef.current,
      { platform: rtp.platform },
    );
    if (isStandardOnboardingApplicant) {
      await deps.saveInterviewResults(parsed, finalGateResult, deps.userId);
      await commitStandardOnboardingUsersAfterAttempt(supabase, {
        userId: deps.userId!,
        attemptIdForUserRow: attemptId,
        gateOkForInterviewPassed: !gateBlockedAlpha,
        interviewAttemptCount: attemptNum,
      });
      deps.queryClient.invalidateQueries({ queryKey: ['deps.profile', deps.userId] });
      writeSessionLog({
        userId: deps.userId,
        attemptId,
        eventType: 'session_complete',
        eventData: {
          session_correlation_id: deps.interviewSessionIdRef.current,
          path: 'standard_onboarding_post_insert',
        },
        platform: getSessionLogRuntime().platform,
      });
      deps.setPendingScoringSyncAttemptId(attemptId);
      await remoteLog('[8] standard_onboarding awaiting rollup before post-interview', {
        attemptId,
      });
    } else {
      const scoringVisible = await waitForInterviewAttemptScoringReady(supabase, attemptId, {
        maxMs: 180_000,
        intervalMs: 400,
      });
      if (scoringVisible) {
        deps.setPendingScoringSyncAttemptId(null);
        deps.setAnalysisAttemptId(attemptId);
        await remoteLog('[6] setAnalysisAttemptId called', { id: attemptId });
        if (__DEV__) console.log('=== [6] latestAttemptId set ===', attemptId);
        setInterviewJustCompletedInSession(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
        writeSessionLog({
          userId: deps.userId,
          attemptId,
          eventType: 'session_complete',
          eventData: { session_correlation_id: deps.interviewSessionIdRef.current },
          platform: getSessionLogRuntime().platform,
        });
        deps.setInterviewStatus('congratulations');
        await remoteLog('[8] deps.setInterviewStatus called', { screen: 'congratulations' });
        if (__DEV__) console.log('=== [8] Navigation complete ===');
      } else {
        await remoteLog(
          '[WARN] Attempt row scoring fields not confirmed after extended wait — stay on preparing_results',
          { attemptId },
        );
        deps.setPendingScoringSyncAttemptId(attemptId);
      }
    }
  } else {
    await remoteLog('[ERROR] Alpha save missing attempt id after insert', {});
  }

  return attemptId;
}

export async function resolveAlphaModeAttemptNumber(
  userId: string | null | undefined,
  existingAttemptId: string | null,
): Promise<number> {
  return resolveAttemptNumberForCompletion(userId, existingAttemptId);
}
