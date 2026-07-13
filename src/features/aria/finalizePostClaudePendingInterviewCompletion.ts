import { buildPostClaudeScenarioScoresPayload } from '@features/aria/buildPostClaudeScenarioScoresPayload';
import type { PostClaudeAssistantTurnDeps } from '@features/aria/postClaudeAssistantTurnTypes';
import { compactInterviewTranscriptTurns } from '@features/aria/interviewTranscriptDedup';
import { remoteLog } from '@utilities/remoteLog';
import { getCurrentScenario } from '@utilities/storage/InterviewStorage';

export type PostClaudePendingCompletionSource =
  | 'interview_complete_token'
  | 'closing_duplicate_suppressed_handoff'
  | 'closing_stream_only_handoff'
  | 'elongating_suppressed_m5_close'
  | 'closing_failsafe';

export type PostClaudeCompletionTranscriptTurn = {
  role: string;
  content?: string | null;
};

export function markPostClaudeInterviewCompletionState(deps: PostClaudeAssistantTurnDeps): void {
  deps.interviewMomentsCompleteRef.current[4] = true;
  deps.interviewMomentsCompleteRef.current[5] = true;
  deps.currentInterviewMomentRef.current = 5;
  deps.isInterviewCompleteRef.current = true;
}

async function persistPostClaudePendingCompletionProgress(
  deps: PostClaudeAssistantTurnDeps,
  transcriptForScoring: PostClaudeCompletionTranscriptTurn[],
): Promise<void> {
  if (!deps.userId) {
    return;
  }
  try {
    await deps.saveInterviewProgress(deps.userId, {
      messages: transcriptForScoring,
      scenariosCompleted: Array.from(deps.scoredScenariosRef.current),
      scenarioScores: buildPostClaudeScenarioScoresPayload(deps),
      currentScenario: getCurrentScenario(deps.scoredScenariosRef.current),
      resumeActiveScenario: deps.resumeActiveScenarioRef.current,
      emotionItemResponses: [...deps.emotionItemResponsesRef.current],
      pendingCompletion: true,
    });
  } catch (persistErr) {
    void remoteLog('[WARN] saveInterviewProgress_failed_before_pending_completion', {
      message: persistErr instanceof Error ? persistErr.message : String(persistErr),
    });
  }
}

async function catchUpPostClaudeEmotionModalsBeforeClose(
  deps: PostClaudeAssistantTurnDeps,
  source: string,
): Promise<void> {
  const unansweredEmotionAtClose = deps.listUnansweredEmotionModalIndices(
    deps.emotionItemResponsesRef.current,
    3,
  );
  if (unansweredEmotionAtClose.length === 0) {
    return;
  }
  void remoteLog('[EMOTION_MODAL] catch_up_before_interview_complete', {
    indices: unansweredEmotionAtClose,
    source,
  });
  for (const itemIndex of unansweredEmotionAtClose) {
    await deps.awaitEmotionModalForIndex(itemIndex);
  }
}

export type FinalizePostClaudePendingInterviewCompletionOptions = {
  source: PostClaudePendingCompletionSource;
  transcriptForScoring: PostClaudeCompletionTranscriptTurn[];
  persistSessionLifecycle?: boolean;
  markCompletionState?: boolean;
  catchUpEmotionModals?: boolean;
  emotionCatchUpSource?: string;
  syncScoringAttemptId?: boolean;
  trackScoreInterviewAttempted?: boolean;
  setVoiceIdle?: boolean;
};

/**
 * Shared tail for post-Claude paths that hand off to pending completion / preparing_results.
 * Returns whether kickCompletionScoring accepted the handoff.
 */
export async function finalizePostClaudePendingInterviewCompletion(
  deps: PostClaudeAssistantTurnDeps,
  options: FinalizePostClaudePendingInterviewCompletionOptions,
): Promise<boolean> {
  const {
    source,
    transcriptForScoring,
    persistSessionLifecycle = true,
    markCompletionState = true,
    /** Emotion modals belong at scenario boundaries during the interview — not at M5 close. */
    catchUpEmotionModals = false,
    emotionCatchUpSource = source,
    syncScoringAttemptId = source === 'interview_complete_token',
    trackScoreInterviewAttempted =
      source === 'closing_failsafe' || source === 'closing_stream_only_handoff',
    setVoiceIdle = false,
  } = options;

  if (persistSessionLifecycle) {
    void deps.persistInterviewAttemptSessionLifecycle(deps.interviewSessionAttemptIdRef.current, 'completed');
  }
  if (markCompletionState) {
    markPostClaudeInterviewCompletionState(deps);
  }
  if (setVoiceIdle) {
    deps.setVoiceState('idle');
  }

  deps.pendingCompletionTranscriptRef.current = compactInterviewTranscriptTurns(
    transcriptForScoring,
  );
  await persistPostClaudePendingCompletionProgress(
    deps,
    deps.pendingCompletionTranscriptRef.current,
  );

  if (catchUpEmotionModals) {
    await catchUpPostClaudeEmotionModalsBeforeClose(deps, emotionCatchUpSource);
  }

  const kicked = deps.kickCompletionScoring(
    source,
    deps.pendingCompletionTranscriptRef.current,
  );
  if (trackScoreInterviewAttempted && kicked) {
    deps.scoreInterviewAttemptedRef.current = true;
  }

  deps.interviewStatusRef.current = 'preparing_results';
  deps.setInterviewStatus('preparing_results');
  if (deps.userId) {
    deps.markPreparingResultsSession(deps.userId);
  }
  deps.setPendingCompletion(true);

  if (syncScoringAttemptId) {
    const attemptForPoll = deps.interviewSessionAttemptIdRef.current;
    if (deps.userId && typeof attemptForPoll === 'string' && attemptForPoll.length > 0) {
      deps.setPendingScoringSyncAttemptId(attemptForPoll);
    }
  }

  return kicked;
}
