import React, { useCallback, useEffect, useRef } from 'react';
import { PreparingResultsView } from '@app/screens/PreparingResultsView';
import { supabase } from '@data/supabase/client';
import {
  fetchMostRecentCompletedInterviewAttemptId,
  fetchUserLoginRoutingRow,
} from '@features/psychometrics/interviewCompletionStatus';
import { waitForInterviewAttemptScoringReady } from '@utilities/waitForInterviewAttemptScoringReady';

type Props = {
  userId: string;
  navigation: {
    replace: (screen: string) => void;
  };
};

const POLL_MS = 2500;
const MAX_WAIT_MS = 180_000;

async function resolveLatestAttemptId(userId: string): Promise<string | null> {
  const completedId = await fetchMostRecentCompletedInterviewAttemptId(userId);
  if (completedId) return completedId;

  const routing = await fetchUserLoginRoutingRow(userId);
  const latestId =
    typeof routing?.latest_attempt_id === 'string' && routing.latest_attempt_id.length > 0
      ? routing.latest_attempt_id
      : null;
  if (!latestId) return null;

  const { data } = await supabase
    .from('interview_attempts')
    .select('completed_at')
    .eq('id', latestId)
    .eq('user_id', userId)
    .maybeSingle();

  return data?.completed_at ? latestId : null;
}

/**
 * RELATIONSHIP validation track: wait for the AI interview attempt to finish saving
 * before returning to the validation report (full report unlock).
 */
export function ValidationPostInterviewProcessingScreen({ userId, navigation }: Props) {
  const navigatedRef = useRef(false);

  const advanceToReport = useCallback(() => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    navigation.replace('ValidationReport');
  }, [navigation]);

  const checkReady = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    const attemptId = await resolveLatestAttemptId(userId);
    if (!attemptId) return false;

    const scoringReady = await waitForInterviewAttemptScoringReady(supabase, attemptId, {
      maxMs: 4000,
      intervalMs: 400,
    });
    if (scoringReady) return true;

    const { data } = await supabase
      .from('interview_attempts')
      .select('completed_at')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .maybeSingle();

    return Boolean(data?.completed_at);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled || navigatedRef.current) return;
      try {
        const ready = await checkReady();
        if (cancelled || navigatedRef.current) return;
        if (ready) {
          advanceToReport();
          return;
        }
        if (Date.now() - startedAt >= MAX_WAIT_MS) {
          advanceToReport();
        }
      } catch (err) {
        console.warn('[ValidationPostInterviewProcessing] poll failed:', err);
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);

    const channel = supabase
      .channel(`validation_interview_ready_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'interview_attempts', filter: `user_id=eq.${userId}` },
        () => void poll(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
        () => void poll(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [userId, checkReady, advanceToReport]);

  return <PreparingResultsView />;
}
