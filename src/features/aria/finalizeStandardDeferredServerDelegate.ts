import type { SupabaseClient } from '@supabase/supabase-js';

import { updateUserInterviewApplication } from '@data/repos/usersInterviewRepo';
import { markPreparingResultsSession } from '@features/aria/interviewLocalPersistence';
import { commitStandardOnboardingUsersAfterAttempt } from '@features/aria/scoreInterviewOnboardingCommit';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import { applyPsychometricModifierToAttempt } from '@features/psychometrics/applyPsychometricModifier';
import { remoteLog } from '@utilities/remoteLog';
import { runCommunicationStylePipelineAfterSave } from '@utilities/runCommunicationStylePipeline';
import {
  assignAttemptIdForSessionLogs,
  getSessionLogRuntime,
} from '@utilities/sessionLogging';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';
import { clearInterviewFromStorage } from '@utilities/storage/InterviewStorage';

export async function finalizeStandardDeferredServerDelegate(params: {
  supabase: SupabaseClient;
  deps: ScoreInterviewDeps;
  rowPayload: Record<string, unknown>;
  existingAttemptId: string | null;
  completionGateOk: boolean;
  completionGateIncompleteReason: string | null;
  nextAttemptNumber: number;
}): Promise<string> {
  const {
    supabase,
    deps,
    rowPayload,
    existingAttemptId,
    completionGateOk,
    completionGateIncompleteReason,
    nextAttemptNumber,
  } = params;

  let attemptId: string | null = null;
  if (existingAttemptId) {
    const { error: upe } = await supabase
      .from('interview_attempts')
      .update(rowPayload)
      .eq('id', existingAttemptId)
      .eq('user_id', deps.userId);
    if (upe) throw new Error(upe.message);
    attemptId = existingAttemptId;
  } else {
    const { data: ins, error: ine } = await supabase
      .from('interview_attempts')
      .insert(rowPayload)
      .select('id')
      .single();
    if (ine) throw new Error(ine.message);
    attemptId = (ins as { id?: string })?.id ?? null;
  }
  if (!attemptId) throw new Error('Missing attempt id after save');
  assignAttemptIdForSessionLogs(attemptId);
  await updateUserInterviewApplication(deps.userId!, {
    applicationStatus: 'under_review',
    onboardingStage: 'complete',
  });
  deps.queryClient.invalidateQueries({ queryKey: ['profile', deps.userId] });
  deps.queryClient.invalidateQueries({ queryKey: ['initialInterviewRoute', deps.userId] });
  const { data: edgeData, error: edgeInvokeError } = await supabase.functions.invoke<{
    ok?: boolean;
    error?: string;
    skipped?: string;
  }>('complete-standard-interview', { body: { attempt_id: attemptId } });
  if (edgeInvokeError) {
    await remoteLog('[STANDARD] complete-standard-interview invoke failed (will use client scoring)', {
      attemptId,
      message: edgeInvokeError.message,
    });
    if (__DEV__) {
      console.warn('[Amoraea] complete-standard-interview', edgeInvokeError.message);
    }
    throw new Error(`EDGE_INVOKE:${edgeInvokeError.message}`);
  }
  const edgeBody = edgeData as { ok?: boolean; error?: string; skipped?: string } | null;
  if (edgeBody && edgeBody.ok === false && edgeBody.error) {
    await remoteLog('[STANDARD] complete-standard-interview returned error (will use client scoring)', {
      attemptId,
      error: edgeBody.error,
    });
    throw new Error(`EDGE:${edgeBody.error}`);
  }
  if (edgeBody?.skipped === 'not_deferred') {
    await remoteLog('[STANDARD] complete-standard-interview skipped not_deferred (will use client scoring)', {
      attemptId,
    });
    throw new Error('EDGE_SKIPPED_NOT_DEFERRED');
  }
  if (edgeBody?.skipped === 'completion_gate_incomplete') {
    await remoteLog('[STANDARD] complete-standard-interview incomplete gate (will use client scoring)', {
      attemptId,
      incomplete_reason: completionGateOk === false ? completionGateIncompleteReason : null,
    });
    throw new Error('EDGE_GATE_INCOMPLETE');
  }
  console.log(`[rollup] Edge scoring complete for attempt ${attemptId} — applying psychometric gate`);
  await applyPsychometricModifierToAttempt(deps.userId, attemptId);
  console.log(`[rollup] Psychometric / interview-only gate applied for attempt ${attemptId}`);
  writeSessionLog({
    userId: deps.userId,
    attemptId,
    eventType: 'session_complete',
    eventData: { path: 'standard_onboarding_server_scoring', server_delegate: true, edge_ok: true },
    platform: getSessionLogRuntime().platform,
  });
  {
    const rtp = getSessionLogRuntime();
    void runCommunicationStylePipelineAfterSave(deps.userId, attemptId, deps.interviewSessionIdRef.current, {
      platform: rtp.platform,
    });
  }
  await commitStandardOnboardingUsersAfterAttempt(supabase, {
    userId: deps.userId!,
    attemptIdForUserRow: attemptId,
    gateOkForInterviewPassed: completionGateOk,
    interviewAttemptCount: nextAttemptNumber,
  });
  await clearInterviewFromStorage(deps.userId);
  await remoteLog('[STANDARD] application saved; awaiting rollup before post-interview', {
    attemptId,
  });
  deps.interviewStatusRef.current = 'preparing_results';
  deps.setInterviewStatus('preparing_results');
  if (deps.userId) markPreparingResultsSession(deps.userId);
  deps.setPendingScoringSyncAttemptId(attemptId);
  deps.setStatus('results');
  return attemptId;
}
