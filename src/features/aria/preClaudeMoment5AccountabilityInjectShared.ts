import { shouldSaveToStorage } from '@features/aria/interviewLocalPersistence';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  isMoment5AssistantAnchor,
  looksLikeMoment5AccountabilityProbeAssistantPrompt,
  looksLikeMoment5ConflictValidityClarificationPrompt,
  looksLikeMoment5ResolutionFollowUpPrompt,
  looksLikeMoment5SpecificityRedirectPrompt,
} from '@features/aria/probeAndScoringUtils';
import {
  moment5DeliveryRefsIndicateQuestionDelivered,
  transcriptHasMoment5PrimaryConflictAnchor,
} from '@features/aria/moment5DeliveryReconcile';
import { transcriptAwaitingUserAnswerAfterMoment5ResolutionFollowUp } from '@features/aria/moment5SpecificityRedirect';
import {
  getCurrentScenario,
  loadInterviewFromStorage,
  mergeInterviewStoragePayload,
  saveInterviewToStorage,
} from '@utilities/storage/InterviewStorage';

export type PreClaudeMoment5AccountabilityInjectGatesResult = {
  handled: boolean;
  moment5CombinedUserText: string;
};

export function moment5ScenarioNumber(deps: PreClaudeTurnGateDeps): 1 | 2 | 3 {
  return ((deps.currentScenarioRef.current as 1 | 2 | 3 | undefined) ?? 3) as 1 | 2 | 3;
}

export function isPreClaudeMoment5AccountabilityProbeCandidate(
  deps: PreClaudeTurnGateDeps,
  lastInterviewerContent: string,
  messagesToUse?: readonly { role?: string; content?: string | null; isWelcomeBack?: boolean }[],
): boolean {
  const moment5QuestionDelivered =
    moment5DeliveryRefsIndicateQuestionDelivered(deps) ||
    (messagesToUse != null && transcriptHasMoment5PrimaryConflictAnchor(messagesToUse));
  const answeringResolutionFollowUp =
    messagesToUse != null && transcriptAwaitingUserAnswerAfterMoment5ResolutionFollowUp(messagesToUse);
  return (
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    deps.status === 'active' &&
    !deps.closingQuestionPending &&
    deps.waitingForClosingAdditionRef.current === null &&
    deps.currentInterviewMomentRef.current === 5 &&
    moment5QuestionDelivered &&
    !deps.moment5AccountabilityProbeFiredRef.current &&
    !looksLikeMoment5AccountabilityProbeAssistantPrompt(lastInterviewerContent) &&
    (isMoment5AssistantAnchor(lastInterviewerContent) ||
      looksLikeMoment5SpecificityRedirectPrompt(lastInterviewerContent) ||
      looksLikeMoment5ConflictValidityClarificationPrompt(lastInterviewerContent) ||
      looksLikeMoment5ResolutionFollowUpPrompt(lastInterviewerContent) ||
      answeringResolutionFollowUp)
  );
}

export async function persistMoment5AssistantInject(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
  assistantMsg: MessageWithScenario,
  extra?: { moment_5_clarification_fired?: boolean },
): Promise<void> {
  if (!deps.userId || deps.isAdmin || deps.status !== 'active') {
    return;
  }
  const persistedMsgs = [...messagesToUse, assistantMsg].filter(
    (m) => !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack,
  );
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
  const priorLocal = await loadInterviewFromStorage(deps.userId);
  const merged = mergeInterviewStoragePayload(priorLocal, {
    messages: persistedMsgs,
    scenariosCompleted: completed,
    scenarioScores: { ...(priorLocal?.scenarioScores ?? {}), ...scenarioScoresPayload },
    currentScenario: getCurrentScenario(deps.scoredScenariosRef.current),
    resumeActiveScenario: deps.resumeActiveScenarioRef.current,
    pendingCompletion:
      (priorLocal?.pendingCompletion ?? false) || deps.interviewStatusRef.current === 'preparing_results',
    sessionAttemptId: deps.interviewSessionAttemptIdRef.current ?? priorLocal?.sessionAttemptId,
    attemptNumber: priorLocal?.attemptNumber ?? 1,
    moment_5_clarification_fired:
      extra?.moment_5_clarification_fired ?? deps.moment5ConflictValidityClarificationIssuedRef.current,
  });
  if (shouldSaveToStorage(merged.messages, merged.scenariosCompleted, merged.currentScenario)) {
    await saveInterviewToStorage(deps.userId, merged);
  }
}

export function finishPreClaudeMoment5AssistantInject(
  deps: PreClaudeTurnGateDeps,
  moment5CombinedUserText: string,
): PreClaudeMoment5AccountabilityInjectGatesResult {
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  return { handled: true, moment5CombinedUserText };
}
