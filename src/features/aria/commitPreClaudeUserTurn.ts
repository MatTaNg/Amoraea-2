import {
  tagInterviewTranscriptMessages,
  type MessageWithScenario,
} from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  buildPreClaudeSessionSpokenDeliveryHints,
  syncInterviewScenarioRefsFromSessionState,
} from '@features/aria/interviewScenarioRefSync';
import {
  shouldReplaceLastUserTurnWithRefinedTranscript,
  compactInterviewTranscriptTurns,
} from '@features/aria/interviewTranscriptDedup';
import { getScenarioNumberForNewMessage } from '@features/aria/scenarioNumberDetection';
import { shouldCreateAttemptOnFirstSubstantiveResponse } from '@features/interview/interviewAttemptLifecycle';
import { supabase } from '@data/supabase/client';
import { persistResponseTimingsToAttempt } from '@utilities/persistResponseTimingsIncremental';
import type { InterviewResponseTimingEntry } from '@utilities/persistResponseTimingsIncremental';

export type CommitPreClaudeUserTurnResult = {
  messagesToUse: MessageWithScenario[];
  userScenarioTag: number;
};

/** Append user turn to transcript, enter processing state, and create attempt on first substantive response. */
export async function commitPreClaudeUserTurn(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
): Promise<CommitPreClaudeUserTurnResult> {
  const prevMessages = (
    deps.currentMessagesRef.current.length > 0
      ? deps.currentMessagesRef.current
      : deps.messages
  ) as MessageWithScenario[];
  syncInterviewScenarioRefsFromSessionState(deps, prevMessages, buildPreClaudeSessionSpokenDeliveryHints(deps));
  const syncedMomentN = deps.currentInterviewMomentRef.current;
  let userScenarioTag =
    (deps.currentScenarioRef.current as number | undefined) ??
    getScenarioNumberForNewMessage(prevMessages, 'user');
  if (syncedMomentN >= 4) {
    userScenarioTag = 3;
  }
  const userMsg: MessageWithScenario = {
    role: 'user',
    content: trimmed,
    scenarioNumber: userScenarioTag as 1 | 2 | 3,
    interviewMoment: syncedMomentN,
  };
  let workingMessages = prevMessages;
  while (workingMessages.length >= 2) {
    const trailingUser = workingMessages[workingMessages.length - 1];
    const trailingPriorUser = workingMessages[workingMessages.length - 2];
    if (
      trailingUser?.role === 'user' &&
      trailingPriorUser?.role === 'user' &&
      shouldReplaceLastUserTurnWithRefinedTranscript(
        trailingPriorUser.content,
        trailingUser.content,
      )
    ) {
      workingMessages = workingMessages.slice(0, -1);
    } else {
      break;
    }
  }
  const lastPrev = workingMessages[workingMessages.length - 1];
  const secondLastPrev = workingMessages[workingMessages.length - 2];
  const replaceLastUserTurn =
    lastPrev?.role === 'user' &&
    shouldReplaceLastUserTurnWithRefinedTranscript(lastPrev.content, trimmed);
  const replaceSecondLastUserTurn =
    !replaceLastUserTurn &&
    lastPrev?.role === 'user' &&
    secondLastPrev?.role === 'user' &&
    shouldReplaceLastUserTurnWithRefinedTranscript(secondLastPrev.content, trimmed);
  const messagesToUse = tagInterviewTranscriptMessages(
    compactInterviewTranscriptTurns(
      lastPrev?.role === 'user'
        ? replaceSecondLastUserTurn
          ? [...workingMessages.slice(0, -2), userMsg]
          : [...workingMessages.slice(0, -1), userMsg]
        : [...workingMessages, userMsg],
    ),
  );
  deps.currentMessagesRef.current = messagesToUse;
  deps.commitInterviewMessages(messagesToUse);
  deps.setCurrentTranscript('');
  deps.transcriptAtReleaseRef.current = '';
  deps.markAiProcessingTurnStarted();
  deps.setVoiceState('processing');
  deps.setIsWaiting(true);
  deps.setExchangeCount((c) => c + 1);

  if (
    deps.userId &&
    !deps.isAdmin &&
    deps.isInterviewAppRoute &&
    deps.status === 'active' &&
    !deps.interviewSessionAttemptIdRef.current &&
    !deps.interviewAttemptCreationInFlightRef.current &&
    shouldCreateAttemptOnFirstSubstantiveResponse({
      isAdmin: deps.isAdmin,
      isInterviewAppRoute: deps.isInterviewAppRoute,
      status: deps.status,
      existingAttemptId: deps.interviewSessionAttemptIdRef.current,
      currentInterviewMoment: deps.currentInterviewMomentRef.current,
      currentScenario: (deps.currentScenarioRef.current as number) ?? userScenarioTag,
      userText: trimmed,
      lastAssistantQuestionText:
        deps.lastQuestionTextRef.current ??
        [...messagesToUse].reverse().find((m) => m.role === 'assistant')?.content ??
        '',
    })
  ) {
    deps.interviewAttemptCreationInFlightRef.current = true;
    try {
      const device = await deps.collectDeviceContext();
      const newAttemptId = await deps.createInterviewAttemptOnFirstSubstantiveResponse(
        deps.userId,
        trimmed,
        1,
        device.platform,
      );
      if (newAttemptId) {
        deps.interviewSessionAttemptIdRef.current = newAttemptId;
        deps.resetSessionLogRuntime({
          sessionCorrelationId: deps.interviewSessionIdRef.current,
          attemptId: newAttemptId,
          sessionLogsRequireAttemptId: true,
        });
        deps.assignAttemptIdForSessionLogs(newAttemptId);
        if (deps.responseTimingsRef.current.length > 0) {
          void persistResponseTimingsToAttempt(
            supabase,
            newAttemptId,
            deps.userId,
            deps.responseTimingsRef.current as InterviewResponseTimingEntry[],
          );
        }
      }
    } finally {
      deps.interviewAttemptCreationInFlightRef.current = false;
    }
  }

  return { messagesToUse, userScenarioTag };
}
