import type { MutableRefObject } from 'react';

import { isResumeWelcomePlaybackLocked } from '@features/aria/interviewLocalPersistence';
import { shouldAllowResumeRepeatChoiceTurnProcessing } from '@features/aria/resumeRepeatGate';

export type ResumeWelcomeTurnProcessingGateRefs = {
  resumeLoadingFlowActiveRef: MutableRefObject<boolean>;
  resumeOfferWelcomeTtsRef: MutableRefObject<boolean>;
  resumeRepeatChoicePendingRef: MutableRefObject<boolean>;
  interviewSessionAttemptIdRef?: MutableRefObject<string | null>;
};

export type ResumeWelcomeTurnProcessingGateOptions = {
  /** When repeat-choice is pending, allow substantive answers through to normal turn processing. */
  substantiveTranscript?: {
    text: string;
    wordCount: number;
    lastQuestionText?: string | null;
  };
};

/** True while resume welcome / repeat-choice must own the audio channel (no turn TTS). */
export function isResumeWelcomeFlowBlockingTurnProcessing(
  refs: ResumeWelcomeTurnProcessingGateRefs,
  options?: ResumeWelcomeTurnProcessingGateOptions,
): boolean {
  if (refs.resumeLoadingFlowActiveRef.current) return true;
  if (refs.resumeRepeatChoicePendingRef.current) {
    const bypass = options?.substantiveTranscript;
    if (
      bypass &&
      shouldAllowResumeRepeatChoiceTurnProcessing(
        bypass.text,
        bypass.wordCount,
        bypass.lastQuestionText,
      )
    ) {
      return false;
    }
    return true;
  }
  const attemptId = refs.interviewSessionAttemptIdRef?.current;
  if (isResumeWelcomePlaybackLocked(attemptId)) return true;
  return false;
}

export function isStaleInterviewUserTurn(
  epochAtStart: number,
  epochRef: MutableRefObject<number>,
): boolean {
  return epochAtStart !== epochRef.current;
}
