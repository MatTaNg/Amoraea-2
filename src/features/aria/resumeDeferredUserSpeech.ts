import type { MutableRefObject } from 'react';

import { isResumeWelcomeFlowBlockingTurnProcessing } from '@features/aria/resumeWelcomeTurnProcessingGate';
import { remoteLog } from '@utilities/remoteLog';

/** Holds a user turn transcribed while resume welcome / intro playback owns the audio channel. */
let pendingResumeDeferredUserSpeech: string | null = null;

export function queueResumeDeferredUserSpeech(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  pendingResumeDeferredUserSpeech = trimmed;
}

export function takeResumeDeferredUserSpeech(): string | null {
  const text = pendingResumeDeferredUserSpeech;
  pendingResumeDeferredUserSpeech = null;
  return text;
}

export function peekResumeDeferredUserSpeech(): string | null {
  return pendingResumeDeferredUserSpeech;
}

export function clearResumeDeferredUserSpeech(): void {
  pendingResumeDeferredUserSpeech = null;
}

export type ResumeDeferredSpeechFlushDeps = {
  processUserSpeech?: (text: string) => void | Promise<void>;
  resumeLoadingFlowActiveRef: MutableRefObject<boolean>;
  resumeOfferWelcomeTtsRef: MutableRefObject<boolean>;
  resumeRepeatChoicePendingRef: MutableRefObject<boolean>;
  interviewSessionAttemptIdRef?: MutableRefObject<string | null>;
  currentMessagesRef?: MutableRefObject<
    ReadonlyArray<{ role: string; content?: string | null; isWelcomeBack?: boolean }>
  >;
};

/** Process deferred user speech once resume welcome playback no longer owns the audio channel. */
export async function flushResumeDeferredUserSpeechWhenUnblocked(
  deps: ResumeDeferredSpeechFlushDeps,
  options?: { maxWaitMs?: number; pollMs?: number },
): Promise<void> {
  if (!peekResumeDeferredUserSpeech() || !deps.processUserSpeech) return;

  const maxWaitMs = options?.maxWaitMs ?? 120_000;
  const pollMs = options?.pollMs ?? 50;
  const start = Date.now();
  const gateRefs = {
    resumeLoadingFlowActiveRef: deps.resumeLoadingFlowActiveRef,
    resumeOfferWelcomeTtsRef: deps.resumeOfferWelcomeTtsRef,
    resumeRepeatChoicePendingRef: deps.resumeRepeatChoicePendingRef,
    interviewSessionAttemptIdRef: deps.interviewSessionAttemptIdRef,
  };

  while (isResumeWelcomeFlowBlockingTurnProcessing(gateRefs)) {
    if (Date.now() - start > maxWaitMs) {
      void remoteLog('[RESUME_WELCOME] deferred_user_turn_flush_timeout', {
        attemptId: deps.interviewSessionAttemptIdRef?.current ?? null,
        preview: peekResumeDeferredUserSpeech()?.slice(0, 120) ?? null,
      });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  const deferred = takeResumeDeferredUserSpeech();
  if (!deferred?.trim()) return;

  const lastUser = [...(deps.currentMessagesRef?.current ?? [])]
    .reverse()
    .find((m) => m.role === 'user' && !m.isWelcomeBack);
  if (lastUser && typeof lastUser.content === 'string' && lastUser.content.trim() === deferred.trim()) {
    return;
  }

  void remoteLog('[RESUME_WELCOME] processing_deferred_user_turn', {
    attemptId: deps.interviewSessionAttemptIdRef?.current ?? null,
    preview: deferred.slice(0, 120),
  });
  await Promise.resolve(deps.processUserSpeech(deferred));
}
