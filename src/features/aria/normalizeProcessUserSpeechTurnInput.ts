import {
  looksLikeReadinessAffirmation,
  looksLikeReadinessYesHomophone,
  normalizeReadinessHomophoneTranscript,
  countSpokenWords,
} from '@features/aria/interviewLanguageGate';
import type { ProcessUserSpeechDeps } from '@features/aria/processUserSpeechTypes';
import {
  isResumeWelcomeFlowBlockingTurnProcessing,
  isStaleInterviewUserTurn,
} from '@features/aria/resumeWelcomeTurnProcessingGate';
import {
  classifyResumeRepeatIntent,
  isExplicitRepeatRequestPreClassification,
} from '@features/aria/resumeRepeatIntent';
import { remoteLog } from '@utilities/remoteLog';

export type NormalizedProcessUserSpeechTurn =
  | { continue: false }
  | { continue: true; trimmed: string; resumeGatePendingEarly: boolean };

export function normalizeProcessUserSpeechTurnInput(
  deps: ProcessUserSpeechDeps,
  spokenText: string,
): NormalizedProcessUserSpeechTurn {
  const {
    isAdmin,
    isInterviewAppRoute,
    status,
    messages,
    setVoiceState,
    setIsWaiting,
    whisperRatioReaskAttemptsForCurrentQuestionRef,
    resumeRepeatChoicePendingRef,
    resumeLastAssistantTextRef,
    lastQuestionTextRef,
    parallelStreamingTtsRef,
    interviewSessionIdRef,
    metaClassificationForPendingAssistantRef,
    resumeLoadingFlowActiveRef,
    webResumeWelcomeTapPendingRef,
    resumeOfferWelcomeTtsRef,
    webResumeWelcomeTapHandledRef,
    interviewSessionAttemptIdRef,
  } = deps;

  if (
    isResumeWelcomeFlowBlockingTurnProcessing(
      {
        resumeLoadingFlowActiveRef,
        webResumeWelcomeTapPendingRef,
        resumeOfferWelcomeTtsRef,
        resumeRepeatChoicePendingRef,
        webResumeWelcomeTapHandledRef,
        interviewSessionAttemptIdRef,
      },
      {
        substantiveTranscript: {
          text: spokenText.trim(),
          wordCount: countSpokenWords(spokenText),
          lastQuestionText: lastQuestionTextRef.current,
        },
      },
    )
  ) {
    void remoteLog('[RESUME_WELCOME] process_user_speech_blocked', {
      interviewSessionId: interviewSessionIdRef.current,
      resumeLoading: resumeLoadingFlowActiveRef.current,
      welcomeTapPending: webResumeWelcomeTapPendingRef.current,
      welcomeOffered: resumeOfferWelcomeTtsRef.current,
      repeatChoicePending: resumeRepeatChoicePendingRef.current,
    });
    setVoiceState('idle');
    setIsWaiting(false);
    return { continue: false };
  }

  whisperRatioReaskAttemptsForCurrentQuestionRef.current = 0;
  const resumeGatePendingEarly = resumeRepeatChoicePendingRef.current;
  const readinessCueTextsEarly = [
    lastQuestionTextRef.current,
    parallelStreamingTtsRef.current.spokenCompleteText,
    parallelStreamingTtsRef.current.accumulatedFullText,
    ...(resumeGatePendingEarly
      ? messages
          .filter((m) => m.role === 'assistant')
          .slice(-4)
          .map((m) => m.content ?? '')
      : []),
  ];
  let trimmed = normalizeReadinessHomophoneTranscript(spokenText.trim(), readinessCueTextsEarly, {
    resumeGatePending: resumeGatePendingEarly,
  });
  if (trimmed !== spokenText.trim() && looksLikeReadinessYesHomophone(spokenText.trim())) {
    void remoteLog('[INTRO_READINESS_HOMOPHONE_NORMALIZED]', {
      interviewSessionId: interviewSessionIdRef.current,
      resumeGatePending: resumeGatePendingEarly,
      rawPreview: spokenText.trim().slice(0, 40),
      normalizedPreview: trimmed.slice(0, 40),
    });
  }
  if (
    resumeGatePendingEarly &&
    isInterviewAppRoute &&
    !isAdmin &&
    status === 'active' &&
    (looksLikeReadinessYesHomophone(spokenText.trim()) || looksLikeReadinessAffirmation(trimmed)) &&
    classifyResumeRepeatIntent(trimmed) !== 'repeat' &&
    !isExplicitRepeatRequestPreClassification(trimmed)
  ) {
    resumeRepeatChoicePendingRef.current = false;
    resumeLastAssistantTextRef.current = null;
    void remoteLog('[RESUME_WELCOME_ASSENT_CONTINUE]', {
      interviewSessionId: interviewSessionIdRef.current,
      rawPreview: spokenText.trim().slice(0, 40),
      normalizedPreview: trimmed.slice(0, 40),
    });
    setVoiceState('idle');
    setIsWaiting(false);
    return { continue: false };
  }
  metaClassificationForPendingAssistantRef.current = null;
  return { continue: true, trimmed, resumeGatePendingEarly };
}
