import { Platform } from 'react-native';

import { USER_INTERVIEW_ROUTING_TABLE } from '@data/supabase/userInterviewRoutingSelect';
import type {
  InterviewAttemptBootstrapDeps,
  InterviewAttemptBootstrapSignal,
} from '@features/aria/interviewAttemptBootstrapTypes';
import { isSubstantiveInterviewAttempt } from '@features/interview/interviewAttemptLifecycle';
import { remoteLog } from '@utilities/remoteLog';
import { hydrateResponseTimingsRefFromAttempt } from '@utilities/persistResponseTimingsIncremental';
import { shouldResumeMidInterviewFromSaved } from '@utilities/interviewResumeCursor';
import {
  mergeInterviewStoragePayload,
  saveInterviewToStorage,
  type StoredInterviewData,
} from '@utilities/storage/InterviewStorage';

/** Create or restore interview attempt before TTS; new attempts deferred until first substantive Scenario A answer. */
export async function runInterviewAttemptBootstrap(
  deps: InterviewAttemptBootstrapDeps,
  signal: InterviewAttemptBootstrapSignal,
): Promise<void> {
  const finishWithStoredAttempt = async (attemptId: string, logTag: string) => {
    deps.interviewSessionAttemptIdRef.current = attemptId;
    deps.resetSessionLogRuntime({
      sessionCorrelationId: deps.interviewSessionIdRef.current,
      attemptId,
      sessionLogsRequireAttemptId: true,
    });
    if (deps.userId) {
      await hydrateResponseTimingsRefFromAttempt(
        deps.supabase,
        attemptId,
        deps.userId,
        deps.responseTimingsRef,
      );
    }
    await remoteLog(logTag, { attemptId });
    deps.markSessionResumedForNextRecordingStart();
    if (Platform.OS === 'web') {
      deps.syncWebAudioRouteSessionEnvelopeFromCache();
    }
    deps.setInterviewAttemptBootstrap('ready');
  };

  if (!deps.userId || deps.isAdmin) {
    deps.setInterviewAttemptBootstrap('ready');
    return;
  }
  deps.setInterviewAttemptBootstrap('loading');
  try {
    const { data: routingRow } = await deps.supabase
      .from(USER_INTERVIEW_ROUTING_TABLE)
      .select('interview_completed, latest_attempt_id')
      .eq('id', deps.userId)
      .maybeSingle();
    if (signal.isCancelled()) return;

    const latestAttemptId =
      typeof routingRow?.latest_attempt_id === 'string' && routingRow.latest_attempt_id.length > 0
        ? routingRow.latest_attempt_id
        : null;
    let latestAttemptCompletedAt: string | null = null;
    if (latestAttemptId) {
      const { data: latestAttemptMeta } = await deps.supabase
        .from('interview_attempts')
        .select('completed_at')
        .eq('id', latestAttemptId)
        .eq('user_id', deps.userId)
        .maybeSingle();
      latestAttemptCompletedAt =
        typeof latestAttemptMeta?.completed_at === 'string' ? latestAttemptMeta.completed_at : null;
    }

    const interviewDoneForRouting =
      routingRow?.interview_completed === true || latestAttemptCompletedAt != null;
    if (interviewDoneForRouting) {
      await deps.clearInterviewFromStorage(deps.userId);
      deps.setInterviewAttemptBootstrap('ready');
      return;
    }

    const saved = (await deps.loadInterviewFromStorage(deps.userId)) as StoredInterviewData | null;
    if (signal.isCancelled()) return;
    const localHasResumableProgress = Boolean(saved && shouldResumeMidInterviewFromSaved(saved));
    if (saved?.sessionAttemptId) {
      const { data: bootAttempt } = await deps.supabase
        .from('interview_attempts')
        .select('id, completed_at, transcript, is_phantom')
        .eq('id', saved.sessionAttemptId)
        .eq('user_id', deps.userId)
        .maybeSingle();
      const attemptCompleted =
        bootAttempt?.completed_at != null && String(bootAttempt.completed_at).length > 0;
      const attemptMissing = !bootAttempt?.id;
      const attemptNotSubstantive =
        bootAttempt?.id != null && !isSubstantiveInterviewAttempt(bootAttempt);
      if (attemptMissing || attemptCompleted) {
        if (!localHasResumableProgress) {
          await deps.clearInterviewFromStorage(deps.userId);
          await remoteLog('[BOOT] stale_session_attempt_cleared', {
            orphanAttemptId: saved.sessionAttemptId,
            is_phantom: bootAttempt?.is_phantom === true,
            reason: attemptMissing ? 'missing_row' : 'completed',
          });
        } else {
          await remoteLog('[BOOT] kept_local_progress_despite_stale_attempt_row', {
            orphanAttemptId: saved.sessionAttemptId,
            reason: attemptMissing ? 'missing_row' : 'completed',
            messageCount: saved.messages?.length ?? 0,
          });
        }
      } else if (attemptNotSubstantive) {
        if (!localHasResumableProgress) {
          await deps.clearInterviewFromStorage(deps.userId);
          await remoteLog('[BOOT] stale_session_attempt_cleared', {
            orphanAttemptId: saved.sessionAttemptId,
            is_phantom: bootAttempt?.is_phantom === true,
            reason: 'not_substantive_db_transcript',
          });
        } else {
          await deps.supabase
            .from('interview_attempts')
            .update({
              transcript: saved.messages as unknown as object[],
              resume_active_scenario: saved.resumeActiveScenario ?? null,
            })
            .eq('id', saved.sessionAttemptId)
            .eq('user_id', deps.userId);
          await remoteLog('[BOOT] local_transcript_synced_to_attempt', {
            attemptId: saved.sessionAttemptId,
            messageCount: saved.messages?.length ?? 0,
            resumeActiveScenario: saved.resumeActiveScenario ?? null,
          });
          await finishWithStoredAttempt(saved.sessionAttemptId, '[BOOT] attempt_id from storage after local sync');
          return;
        }
      } else {
        await finishWithStoredAttempt(saved.sessionAttemptId, '[BOOT] attempt_id from storage');
        return;
      }
    }
    if (latestAttemptId) {
      const { data: reuseAttempt } = await deps.supabase
        .from('interview_attempts')
        .select('id, completed_at, transcript, is_phantom')
        .eq('id', latestAttemptId)
        .eq('user_id', deps.userId)
        .maybeSingle();
      if (
        reuseAttempt?.id &&
        isSubstantiveInterviewAttempt(reuseAttempt) &&
        reuseAttempt.completed_at == null
      ) {
        deps.interviewSessionAttemptIdRef.current = reuseAttempt.id;
        deps.resetSessionLogRuntime({
          sessionCorrelationId: deps.interviewSessionIdRef.current,
          attemptId: reuseAttempt.id,
          sessionLogsRequireAttemptId: true,
        });
        if (deps.userId) {
          await hydrateResponseTimingsRefFromAttempt(
            deps.supabase,
            reuseAttempt.id,
            deps.userId,
            deps.responseTimingsRef,
          );
        }
        if (saved && saved.sessionAttemptId !== reuseAttempt.id) {
          await saveInterviewToStorage(deps.userId, mergeInterviewStoragePayload(saved, {
            sessionAttemptId: reuseAttempt.id,
          }));
          await remoteLog('[BOOT] storage sessionAttemptId synced to latest_attempt_id', {
            attemptId: reuseAttempt.id,
          });
        }
        await remoteLog('[BOOT] attempt_id from users.latest_attempt_id', { attemptId: reuseAttempt.id });
        deps.markSessionResumedForNextRecordingStart();
        if (Platform.OS === 'web') {
          deps.syncWebAudioRouteSessionEnvelopeFromCache();
        }
        deps.setInterviewAttemptBootstrap('ready');
        return;
      }
    }
    deps.resetSessionLogRuntime({
      sessionCorrelationId: deps.interviewSessionIdRef.current,
      attemptId: null,
      sessionLogsRequireAttemptId: false,
    });
    await remoteLog('[BOOT] attempt deferred until first substantive response', { userId: deps.userId });
    deps.setInterviewAttemptBootstrap('ready');
  } catch (e) {
    await remoteLog('[BOOT] attempt bootstrap exception', {
      message: e instanceof Error ? e.message : String(e),
    });
    deps.setInterviewAttemptBootstrap('failed');
  }
}
