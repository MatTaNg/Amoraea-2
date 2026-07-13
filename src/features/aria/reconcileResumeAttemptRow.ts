import { supabase } from '@data/supabase/client';
import { assignAttemptIdForSessionLogs } from '@utilities/sessionLogging/sessionLogInterview';
import { remoteLog } from '@utilities/remoteLog';
import { clearInterviewFromStorage, saveInterviewToStorage } from '@utilities/storage/InterviewStorage';
import {
  lastFullyCompletedScenario,
  inferLatestScenarioIntroFromTranscript,
} from '@utilities/interviewResumeCursor';
import type { SavedInterviewSnapshot } from '@utilities/storage/InterviewStorage';

export type ResumeAttemptReconcileResult =
  | { kind: 'abort_stale' }
  | {
      kind: 'continue';
      planAttemptMismatch: boolean;
      resumeAttemptResumeScenario: number | null;
      resumeAttemptEmotionResponses: unknown;
      didOrphanAttemptRebind: boolean;
    };

export async function reconcileResumeAttemptRow(params: {
  userId: string | null | undefined;
  saved: SavedInterviewSnapshot;
  bootstrapAttemptId: string | null;
  interviewSessionAttemptIdRef: { current: string | null };
}): Promise<ResumeAttemptReconcileResult> {
  const { userId, saved, bootstrapAttemptId, interviewSessionAttemptIdRef } = params;
  const savedAttemptId = saved.sessionAttemptId ?? null;
  const attemptMismatch = Boolean(
    savedAttemptId && bootstrapAttemptId && savedAttemptId !== bootstrapAttemptId,
  );
  const attemptRowId =
    userId && (savedAttemptId || bootstrapAttemptId)
      ? attemptMismatch
        ? bootstrapAttemptId
        : savedAttemptId ?? bootstrapAttemptId
      : null;

  let planAttemptMismatch = attemptMismatch;
  let resumeAttemptResumeScenario: number | null = null;
  let didOrphanAttemptRebind = false;
  let resumeAttemptEmotionResponses: unknown = null;

  if (!attemptRowId || !userId) {
    return {
      kind: 'continue',
      planAttemptMismatch,
      resumeAttemptResumeScenario,
      resumeAttemptEmotionResponses,
      didOrphanAttemptRebind,
    };
  }

  const { data: resumeAttempt } = await supabase
    .from('interview_attempts')
    .select('id, resume_active_scenario, emotion_recognition_responses')
    .eq('id', attemptRowId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!resumeAttempt?.id) {
    const userTurns = saved.messages?.filter((m) => m.role === 'user').length ?? 0;
    const lastDone = lastFullyCompletedScenario(saved.scenariosCompleted ?? [], saved.scenarioScores);
    const inferredScenario = inferLatestScenarioIntroFromTranscript(saved.messages ?? []);
    const hasSubstantialLocalProgress =
      userTurns >= 2 ||
      (saved.scenariosCompleted?.length ?? 0) > 0 ||
      lastDone > 0 ||
      saved.resumeActiveScenario === 2 ||
      saved.resumeActiveScenario === 3 ||
      inferredScenario === 2 ||
      inferredScenario === 3;
    if (bootstrapAttemptId && hasSubstantialLocalProgress) {
      didOrphanAttemptRebind = true;
      planAttemptMismatch = false;
      resumeAttemptResumeScenario = null;
      interviewSessionAttemptIdRef.current = bootstrapAttemptId;
      assignAttemptIdForSessionLogs(bootstrapAttemptId);
      await saveInterviewToStorage(userId, {
        ...saved,
        sessionAttemptId: bootstrapAttemptId,
      });
      await supabase
        .from('interview_attempts')
        .update({
          resume_active_scenario: saved.resumeActiveScenario ?? null,
          transcript: saved.messages as unknown as object[],
        })
        .eq('id', bootstrapAttemptId)
        .eq('user_id', userId);
      await remoteLog('[resume] orphan_attempt_rebound_to_bootstrap', {
        missingRowId: attemptRowId,
        bootstrapId: bootstrapAttemptId,
        userTurns,
        resumeActiveFromStorage: saved.resumeActiveScenario ?? null,
      });
    } else {
      await clearInterviewFromStorage(userId);
      await remoteLog('[resume] stale_session_attempt_cleared', { orphanAttemptId: attemptRowId });
      return { kind: 'abort_stale' };
    }
  } else {
    const ras = resumeAttempt.resume_active_scenario;
    resumeAttemptResumeScenario = typeof ras === 'number' ? ras : null;
    resumeAttemptEmotionResponses = resumeAttempt.emotion_recognition_responses ?? null;
  }

  return {
    kind: 'continue',
    planAttemptMismatch,
    resumeAttemptResumeScenario,
    resumeAttemptEmotionResponses,
    didOrphanAttemptRebind,
  };
}

export function syncResumeAttemptIdForSessionLogs(params: {
  didOrphanAttemptRebind: boolean;
  attemptMismatch: boolean;
  savedAttemptId: string | null;
  bootstrapAttemptId: string | null;
  interviewSessionAttemptIdRef: { current: string | null };
}): void {
  const {
    didOrphanAttemptRebind,
    attemptMismatch,
    savedAttemptId,
    bootstrapAttemptId,
    interviewSessionAttemptIdRef,
  } = params;
  if (!didOrphanAttemptRebind && !attemptMismatch && savedAttemptId) {
    interviewSessionAttemptIdRef.current = savedAttemptId;
    assignAttemptIdForSessionLogs(savedAttemptId);
  } else if (!didOrphanAttemptRebind && bootstrapAttemptId) {
    assignAttemptIdForSessionLogs(bootstrapAttemptId);
  }
}
