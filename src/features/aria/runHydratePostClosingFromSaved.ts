import { supabase } from '@data/supabase/client';
import { assignScenarioNumbersToTranscript, stripEphemeralWelcomeBackMessages } from '@utilities/interviewResumeCursor';
import { kickCompletionScoring } from '@features/aria/completionScoringKick';
import {
  EMOTION_INTERVIEW_MODAL_ITEMS,
  countAnsweredEmotionItems,
  hydrateEmotionResponsesFromSources,
} from '@features/aria/emotionRecognitionInterview';
import { markPreparingResultsSession } from '@features/aria/interviewLocalPersistence';
import { remoteLog } from '@utilities/remoteLog';
import { clearInterviewFromStorage } from '@utilities/storage/InterviewStorage';

import type {
  HydratePostClosingFromSavedDeps,
  HydratePostClosingFromSavedParams,
} from '@features/aria/sessionLifecycleTypes';

export async function runHydratePostClosingFromSaved(
  deps: HydratePostClosingFromSavedDeps,
  params: HydratePostClosingFromSavedParams,
): Promise<void> {
  const {
    userId,
    hasResumedRef,
    resumeLoadingFlowActiveRef,
    setResumeLoadingVisible,
    setMessages,
    pendingCompletionTranscriptRef,
    emotionItemResponsesRef,
    setEmotionItemResponses,
    setEmotionItemsComplete,
    setPendingCompletion,
    isInterviewCompleteRef,
    interviewStatusRef,
    setInterviewStatus,
    resumeOfferWelcomeTtsRef,
  } = deps;
  const { saved, source } = params;

      const aid = saved.sessionAttemptId;
      const aidOk = typeof aid === 'string' && aid.length > 0;
      let attemptStillThere = false;
      if (aidOk && userId) {
        const { data: pendingResumeAttempt } = await supabase
          .from('interview_attempts')
          .select('id')
          .eq('id', aid)
          .eq('user_id', userId)
          .maybeSingle();
        attemptStillThere = !!pendingResumeAttempt?.id;
      }
      if (!aidOk || !attemptStillThere) {
        if (userId) {
          await clearInterviewFromStorage(userId);
          await remoteLog('[resume] stale_post_closing_cleared', {
            source,
            aidOk,
            attemptStillThere,
          });
        }
        resumeLoadingFlowActiveRef.current = false;
        setResumeLoadingVisible(false);
        return;
      }
      hasResumedRef.current = true;
      resumeLoadingFlowActiveRef.current = false;
      setResumeLoadingVisible(false);
      resumeOfferWelcomeTtsRef.current = false;
      const restored = assignScenarioNumbersToTranscript(
        stripEphemeralWelcomeBackMessages(saved.messages ?? []),
      );
      setMessages(restored);
      const transcript = restored.filter((m) => m.role === 'user' || m.role === 'assistant');
      pendingCompletionTranscriptRef.current = transcript;
      const hydratedEmotionPending = hydrateEmotionResponsesFromSources(saved.emotionItemResponses);
      if (aidOk && userId) {
        const { data: attemptEmotion } = await supabase
          .from('interview_attempts')
          .select('emotion_recognition_responses')
          .eq('id', aid)
          .eq('user_id', userId)
          .maybeSingle();
        const mergedPending = hydrateEmotionResponsesFromSources(
          hydratedEmotionPending,
          attemptEmotion?.emotion_recognition_responses,
        );
        if (mergedPending.length > 0) {
          emotionItemResponsesRef.current = mergedPending;
          setEmotionItemResponses(mergedPending);
          setEmotionItemsComplete(
            countAnsweredEmotionItems(mergedPending) >= EMOTION_INTERVIEW_MODAL_ITEMS.length,
          );
        }
      } else if (hydratedEmotionPending.length > 0) {
        emotionItemResponsesRef.current = hydratedEmotionPending;
        setEmotionItemResponses(hydratedEmotionPending);
        setEmotionItemsComplete(
          countAnsweredEmotionItems(hydratedEmotionPending) >= EMOTION_INTERVIEW_MODAL_ITEMS.length,
        );
      }
      setPendingCompletion(true);
      isInterviewCompleteRef.current = true;
      if (userId) markPreparingResultsSession(userId);
      interviewStatusRef.current = 'preparing_results';
      setInterviewStatus('preparing_results');
      void remoteLog('[REENTRY_POST_CLOSING_HANDOFF]', {
        source,
        transcriptLen: transcript.length,
        hadPendingCompletionFlag: saved.pendingCompletion === true,
      });
      kickCompletionScoring(`post_closing_${source}`, transcript);
}
