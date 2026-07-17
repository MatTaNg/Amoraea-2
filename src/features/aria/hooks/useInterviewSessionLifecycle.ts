import { useCallback, useEffect } from 'react';

import { Platform } from 'react-native';

import { supabase } from '@data/supabase/client';
import { USER_INTERVIEW_ROUTING_TABLE } from '@data/supabase/userInterviewRoutingSelect';
import { isGreetingOnly } from '@features/aria/interviewLocalPersistence';
import type { InterviewSessionStatus } from '@features/aria/hooks/useAriaInterviewSession';
import { runHandleResume } from '@features/aria/runHandleResume';
import { runHydratePostClosingFromSaved } from '@features/aria/runHydratePostClosingFromSaved';
import { runStartInterview } from '@features/aria/runStartInterview';
import type {
  InterviewAttemptBootstrap,
  InterviewSessionLifecycleDeps,
} from '@features/aria/sessionLifecycleTypes';
import {
  savedInterviewReachedClosingState,
  shouldResumeMidInterviewFromSaved,
} from '@utilities/interviewResumeCursor';
import { clearInterviewFromStorage, loadInterviewFromStorage } from '@utilities/storage/InterviewStorage';

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
    if (!userId || isAdmin) return;
    const deps = depsRef.current;

    if (deps.interviewStatusRef?.current === 'in_progress') return;
    if (deps.isInterviewCompleteRef?.current) return;

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
        return;
      }

      const saved = await loadInterviewFromStorage(userId);
      if (cancelled) return;

      if (!saved?.messages?.length) {
        depsRef.current.resumeLoadingFlowActiveRef.current = false;
        depsRef.current.setResumeLoadingVisible?.(false);
        return;
      }

      if (savedInterviewReachedClosingState(saved)) {
        await runHydratePostClosingFromSaved(depsRef.current, {
          saved,
          source: 'resume_effect_post_closing',
        });
        return;
      }

      if (isGreetingOnly(saved.messages)) {
        await clearInterviewFromStorage(userId);
        depsRef.current.resumeLoadingFlowActiveRef.current = false;
        depsRef.current.setResumeLoadingVisible?.(false);
        return;
      }

      if (shouldResumeMidInterviewFromSaved(saved)) {
        try {
          await handleResume(saved);
        } catch {
          depsRef.current.resumeLoadingFlowActiveRef.current = false;
          depsRef.current.setResumeLoadingVisible?.(false);
          depsRef.current.hasResumedRef.current = false;
        }
        return;
      }

      if (isGreetingOnly(saved.messages)) {
        await clearInterviewFromStorage(userId);
      }
      depsRef.current.resumeLoadingFlowActiveRef.current = false;
      depsRef.current.setResumeLoadingVisible?.(false);
    })();

    return () => {
      cancelled = true;
      if (depsRef.current.interviewStatusRef?.current !== 'in_progress') {
        depsRef.current.resumeLoadingFlowActiveRef.current = false;
        depsRef.current.setResumeLoadingVisible?.(false);
      }
    };
  }, [userId, isAdmin, handleResume, depsRef]);

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
