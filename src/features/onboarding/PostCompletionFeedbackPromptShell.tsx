import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { PostCompletionFeedbackIntroModal } from '@features/onboarding/PostCompletionFeedbackIntroModal';
import { PostCompletionFeedbackModal } from '@features/onboarding/PostCompletionFeedbackModal';
import { fetchPostCompletionFeedbackSubmittedAt } from '@features/onboarding/postCompletionFeedback';
import {
  fetchUserLoginRoutingRow,
  resolveInterviewCompletedForUser,
} from '@features/psychometrics/interviewCompletionStatus';
import {
  clearReferralCompletionCongratsPending,
  markReferralCompletionCongratsSeen,
  referralCompletionCongratsPendingKey,
  referralCompletionCongratsSeenKey,
  subscribeReferralCompletionCongratsPending,
} from '@features/referrals/referralCompletionCongratsStorage';

type PromptPhase = 'hidden' | 'intro' | 'form';

type PostCompletionFeedbackPromptShellProps = {
  userId: string;
};

/**
 * Replaces the post-completion referral-bonus popup.
 * Shows after interview + psychometrics, using the pending flag set when the
 * battery is saved. A previous referral-popup dismissal does not block it.
 * An already submitted response does.
 */
export function PostCompletionFeedbackPromptShell({ userId }: PostCompletionFeedbackPromptShellProps) {
  const [phase, setPhase] = useState<PromptPhase>('hidden');
  const phaseRef = useRef<PromptPhase>('hidden');
  const checkGenerationRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const dismissPrompt = useCallback(async () => {
    setPhase('hidden');
    phaseRef.current = 'hidden';
    if (!userId) return;
    await markReferralCompletionCongratsSeen(userId);
    await clearReferralCompletionCongratsPending(userId);
  }, [userId]);

  const maybeShowIntro = useCallback(async () => {
    if (!userId || phaseRef.current !== 'hidden') return;
    const generation = ++checkGenerationRef.current;
    const [pending, submittedAt, seen] = await Promise.all([
      AsyncStorage.getItem(referralCompletionCongratsPendingKey(userId)),
      fetchPostCompletionFeedbackSubmittedAt(userId),
      AsyncStorage.getItem(referralCompletionCongratsSeenKey(userId)),
    ]);
    if (generation !== checkGenerationRef.current || submittedAt) return;
    if (pending === '1') {
      phaseRef.current = 'intro';
      setPhase('intro');
      return;
    }
    if (seen === '1') return;
    const routingRow = await fetchUserLoginRoutingRow(userId);
    if (generation !== checkGenerationRef.current) return;
    if (!routingRow?.psychometrics_completed_at) return;
    const interviewCompleted = await resolveInterviewCompletedForUser(userId, routingRow);
    if (generation !== checkGenerationRef.current || !interviewCompleted) return;
    phaseRef.current = 'intro';
    setPhase('intro');
  }, [userId]);

  useEffect(() => {
    void maybeShowIntro();
    return subscribeReferralCompletionCongratsPending(() => {
      void maybeShowIntro();
    });
  }, [maybeShowIntro]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void maybeShowIntro();
    });
    return () => sub.remove();
  }, [maybeShowIntro]);

  return (
    <>
      <PostCompletionFeedbackIntroModal
        visible={phase === 'intro'}
        onGiveFeedback={() => {
          phaseRef.current = 'form';
          setPhase('form');
        }}
        onDecline={() => void dismissPrompt()}
      />
      <PostCompletionFeedbackModal
        visible={phase === 'form'}
        userId={userId}
        entryPoint="intro"
        onDismiss={() => void dismissPrompt()}
        onSubmitted={() => void dismissPrompt()}
      />
    </>
  );
}
