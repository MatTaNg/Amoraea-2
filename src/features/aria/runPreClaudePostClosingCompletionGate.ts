import { transcriptHasInterviewClosingAssistantMessage } from '@features/aria/elongatingProbe';
import { markPreparingResultsSession, saveInterviewProgress } from '@features/aria/interviewLocalPersistence';
import { computeMoment5InterviewCloseGate } from '@features/aria/interviewProgressSync';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { compactInterviewTranscriptTurns } from '@features/aria/interviewTranscriptDedup';
import { persistInterviewAttemptSessionLifecycle } from '@utilities/interviewAttemptLifecycle';
import { remoteLog } from '@utilities/remoteLog';
import { getCurrentScenario } from '@utilities/storage/InterviewStorage';

export type PreClaudePostClosingCompletionGateResult = {
  handled: boolean;
};

/**
 * Post-closing user turn when M5 close gate passes — kick completion scoring and preparing-results.
 */
export async function runPreClaudePostClosingCompletionGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
): Promise<PreClaudePostClosingCompletionGateResult> {
  if (
    deps.isInterviewCompleteRef.current ||
    !deps.isInterviewAppRoute ||
    deps.isAdmin ||
    deps.status !== 'active' ||
    !transcriptHasInterviewClosingAssistantMessage(messagesToUse)
  ) {
    return { handled: false };
  }

  const closeGate = computeMoment5InterviewCloseGate(messagesToUse, {
    moment5QuestionDelivered: deps.moment5QuestionDeliveredRef.current,
    moment5PrimaryAnchorSession: deps.moment5PrimaryAnchorDeliveredSessionRef.current,
    postM5UserTurnsRef: deps.moment5PostPromptUserTurnCountRef.current,
    accountabilityProbeFired: deps.moment5AccountabilityProbeFiredRef.current,
    currentInterviewMoment: deps.currentInterviewMomentRef.current,
    moment5ResolutionDelivered: deps.moment5ResolutionDeliveredRef.current,
  });
  if (!closeGate.hasMoment5PrimaryAnchorInTranscript || !closeGate.moment5CloseAllowed) {
    return { handled: false };
  }

  void remoteLog('[INTERVIEW_COMPLETE_POST_CLOSING_USER_TURN]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    moment5CloseAllowed: closeGate.moment5CloseAllowed,
    postM5UserTurns: closeGate.postM5UserTurns,
    accountabilityProbeStillRequired: closeGate.accountabilityProbeStillRequired,
    resolutionFollowUpStillRequired: closeGate.resolutionFollowUpStillRequired,
    preview: trimmed.slice(0, 220),
  });
  void persistInterviewAttemptSessionLifecycle(deps.interviewSessionAttemptIdRef.current, 'completed');
  deps.interviewMomentsCompleteRef.current[4] = true;
  deps.interviewMomentsCompleteRef.current[5] = true;
  deps.currentInterviewMomentRef.current = 5;
  deps.isInterviewCompleteRef.current = true;
  deps.setVoiceState('idle');
  const transcriptForScoring = compactInterviewTranscriptTurns(
    messagesToUse.filter((m) => m.role === 'user' || m.role === 'assistant'),
  );
  deps.pendingCompletionTranscriptRef.current = transcriptForScoring;
  if (deps.userId) {
    const completed = Array.from(deps.scoredScenariosRef.current);
    const scenarioScoresPayload: Record<
      number,
      {
        pillarScores: Record<string, number | null>;
        pillarConfidence: Record<string, string>;
        keyEvidence: Record<string, string>;
        scenarioName?: string;
      }
    > = {};
    [1, 2, 3].forEach((n) => {
      const s = deps.scenarioScoresRef.current[n] as
        | {
            pillarScores: Record<string, number | null>;
            pillarConfidence: Record<string, string>;
            keyEvidence: Record<string, string>;
            scenarioName?: string;
          }
        | undefined;
      if (s) {
        scenarioScoresPayload[n] = {
          pillarScores: s.pillarScores,
          pillarConfidence: s.pillarConfidence,
          keyEvidence: s.keyEvidence,
          scenarioName: s.scenarioName,
        };
      }
    });
    try {
      await saveInterviewProgress(deps.userId, {
        messages: transcriptForScoring,
        scenariosCompleted: completed,
        scenarioScores: scenarioScoresPayload,
        currentScenario: getCurrentScenario(deps.scoredScenariosRef.current),
        resumeActiveScenario: deps.resumeActiveScenarioRef.current,
        emotionItemResponses: [...deps.emotionItemResponsesRef.current],
        pendingCompletion: true,
        scenarioSkipConfirmedCount: deps.scenarioSkipConfirmedCountRef.current,
      });
    } catch (persistErr) {
      void remoteLog('[WARN] saveInterviewProgress_failed_before_pending_completion', {
        message: persistErr instanceof Error ? persistErr.message : String(persistErr),
      });
    }
  }
  deps.kickCompletionScoring('post_closing_user_turn', transcriptForScoring);
  deps.interviewStatusRef.current = 'preparing_results';
  deps.setInterviewStatus('preparing_results');
  if (deps.userId) markPreparingResultsSession(deps.userId);
  deps.setPendingCompletion(true);
  deps.setIsWaiting(false);
  return { handled: true };
}
