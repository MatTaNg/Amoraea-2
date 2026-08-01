import { useCallback, useEffect } from 'react';

import { Platform } from 'react-native';

import { supabase } from '@data/supabase/client';
import { USER_INTERVIEW_ROUTING_TABLE } from '@data/supabase/userInterviewRoutingSelect';
import { isGreetingOnly } from '@features/aria/interviewLocalPersistence';
import type { InterviewSessionStatus } from '@features/aria/hooks/useAriaInterviewSession';
import { runHandleResume } from '@features/aria/runHandleResume';
import { runHydratePostClosingFromSaved } from '@features/aria/runHydratePostClosingFromSaved';
import { runStartInterview } from '@features/aria/runStartInterview';
import { resolveDevScenarioJumpTargetFromSession } from '@features/aria/devScenarioJumpReferral';
import type {
  InterviewAttemptBootstrap,
  InterviewSessionLifecycleDeps,
} from '@features/aria/sessionLifecycleTypes';
import {
  savedInterviewReachedClosingState,
  shouldResumeMidInterviewFromSaved,
} from '@utilities/interviewResumeCursor';
import { clearInterviewFromStorage, loadInterviewFromStorage } from '@utilities/storage/InterviewStorage';
import { remoteLog } from '@utilities/remoteLog';

export type InterviewSessionLifecycleEffectInputs = {
  userId: string;
  isAdmin: boolean;
  isInterviewAppRoute: boolean;
  status: InterviewSessionStatus;
  interviewStatus:
    | 'loading'
    | 'not_started'
    | 'in_progress'
    | 'preparing_results'
    | 'under_review'
    | 'congratulations'
    | 'analysis';
  interviewAttemptBootstrap: InterviewAttemptBootstrap;
};

export function useInterviewSessionLifecycle(
  depsRef: React.MutableRefObject<InterviewSessionLifecycleDeps>,
  effectInputs: InterviewSessionLifecycleEffectInputs,
) {
  const {
    userId,
    isAdmin,
    isInterviewAppRoute,
    status,
    interviewStatus,
    interviewAttemptBootstrap,
  } = effectInputs;

  const handleResume = useCallback(async (saved: Parameters<typeof runHandleResume>[1]['saved']) => {
    await runHandleResume(depsRef.current, { saved });
  }, [depsRef]);

  const startInterview = useCallback(async (opts?: { fromUserGesture?: boolean }) => {
    await runStartInterview(depsRef.current, opts);
  }, [depsRef]);

  useEffect(() => {
    const finishResumeHydration = () => {
      depsRef.current.setResumeHydrationPending?.(false);
    };

    if (!userId || isAdmin) {
      depsRef.current.resumeLoadingFlowActiveRef.current = false;
      depsRef.current.setResumeLoadingVisible?.(false);
      finishResumeHydration();
      return;
    }
    const deps = depsRef.current;

    if (deps.interviewStatusRef?.current === 'in_progress') {
      finishResumeHydration();
      return;
    }
    if (deps.isInterviewCompleteRef?.current) {
      finishResumeHydration();
      return;
    }

    let cancelled = false;
    depsRef.current.resumeLoadingFlowActiveRef.current = true;
    depsRef.current.setResumeLoadingVisible?.(true);

    (async () => {
      const { data: routingRow } = await supabase
        .from(USER_INTERVIEW_ROUTING_TABLE)
        .select('interview_completed, latest_attempt_id')
        .eq('id', userId)
        .maybeSingle();

      if (cancelled) return;

      let interviewDoneForRouting = routingRow?.interview_completed === true;
      const latestAttemptId =
        typeof routingRow?.latest_attempt_id === 'string' && routingRow.latest_attempt_id.length > 0
          ? routingRow.latest_attempt_id
          : null;

      if (!interviewDoneForRouting && latestAttemptId) {
        const { data: latestAttemptMeta } = await supabase
          .from('interview_attempts')
          .select('completed_at')
          .eq('id', latestAttemptId)
          .eq('user_id', userId)
          .maybeSingle();
        interviewDoneForRouting = !!latestAttemptMeta?.completed_at;
      }

      if (interviewDoneForRouting) {
        await clearInterviewFromStorage(userId);
        depsRef.current.resumeLoadingFlowActiveRef.current = false;
        depsRef.current.setResumeLoadingVisible?.(false);
        finishResumeHydration();
        return;
      }

      const devJumpTarget = await resolveDevScenarioJumpTargetFromSession(undefined);
      if (cancelled) return;
      if (devJumpTarget != null) {
        await clearInterviewFromStorage(userId);
        depsRef.current.hasResumedRef.current = false;
        depsRef.current.resumeLoadingFlowActiveRef.current = false;
        depsRef.current.setResumeLoadingVisible?.(false);
        finishResumeHydration();
        return;
      }

      const saved = await loadInterviewFromStorage(userId);
      if (cancelled) return;

      if (!saved?.messages?.length) {
        depsRef.current.resumeLoadingFlowActiveRef.current = false;
        depsRef.current.setResumeLoadingVisible?.(false);
        finishResumeHydration();
        return;
      }

      if (savedInterviewReachedClosingState(saved)) {
        await runHydratePostClosingFromSaved(depsRef.current, {
          saved,
          source: 'resume_effect_post_closing',
        });
        finishResumeHydration();
        return;
      }

      if (isGreetingOnly(saved.messages)) {
        await clearInterviewFromStorage(userId);
        depsRef.current.resumeLoadingFlowActiveRef.current = false;
        depsRef.current.setResumeLoadingVisible?.(false);
        finishResumeHydration();
        return;
      }

      if (shouldResumeMidInterviewFromSaved(saved)) {
        if (cancelled) return;
        try {
          void remoteLog('[REENTRY_RESUME] mount_hydration_start', {
            userId,
            messageCount: saved.messages.length,
            resumeActiveScenario: saved.resumeActiveScenario ?? null,
          });
          await handleResume(saved);
          if (
            !depsRef.current.hasResumedRef.current &&
            depsRef.current.interviewStatusRef?.current !== 'in_progress'
          ) {
          }
          void remoteLog('[REENTRY_RESUME] mount_hydration_complete', {
            userId,
            interviewStatus: depsRef.current.interviewStatusRef?.current ?? null,
          });
          finishResumeHydration();
        } catch (err) {
          depsRef.current.resumeLoadingFlowActiveRef.current = false;
          depsRef.current.setResumeLoadingVisible?.(false);
          depsRef.current.hasResumedRef.current = false;
          finishResumeHydration();
        }
        return;
      }

      if (isGreetingOnly(saved.messages)) {
        await clearInterviewFromStorage(userId);
      }
      depsRef.current.resumeLoadingFlowActiveRef.current = false;
      depsRef.current.setResumeLoadingVisible?.(false);
      finishResumeHydration();
    })();

    return () => {
      cancelled = true;
      if (
        depsRef.current.interviewStatusRef?.current !== 'in_progress' &&
        !depsRef.current.resumeLoadingFlowActiveRef.current
      ) {
        depsRef.current.setResumeLoadingVisible?.(false);
      }
    };
  }, [userId, isAdmin, handleResume, depsRef]);

  useEffect(() => {
    if (interviewStatus !== 'in_progress') return;
    if (status !== 'intro' && status !== 'starting_interview') return;
    depsRef.current.setStatus('active');
  }, [interviewStatus, status, depsRef]);

  useEffect(() => {
    if (!isInterviewAppRoute) return;
    if (status !== 'starting_interview') return;
    if (interviewStatus !== 'not_started') return;

    const onboardingAutoStartRef = depsRef.current.onboardingAutoStartRef;
    if (!onboardingAutoStartRef || onboardingAutoStartRef.current) return;
    if (Platform.OS === 'web') return;
    if (interviewAttemptBootstrap !== 'ready') return;
    if (depsRef.current.resumeLoadingFlowActiveRef?.current) return;

    onboardingAutoStartRef.current = true;
    void startInterview();
  }, [isInterviewAppRoute, status, interviewStatus, startInterview, interviewAttemptBootstrap, depsRef]);

  useEffect(() => {
  }, [depsRef]);

  return { handleResume, startInterview };
}
