import { sanitizeAssistantInterviewerCharacterNames } from '@/constants/interviewCharacterNames';
import { SCENARIO_2_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import { splitScenarioTransitionForEmotionModal } from '@features/aria/emotionRecognitionInterview';
import {
  isInterviewHardStopUserTurn,
  scenarioALastAssistantIsRepairProbeOrFollowUp,
} from '@features/aria/interviewDisengagementProbes';
import {
  dedupeAdjacentBoundaryValidationsBeforeParticipantName,
  ensureSpokenTextIncludesParticipantFirstName,
} from '@features/aria/interviewerFrameworkPrompt';
import type { InterviewProgressRefs } from '@features/aria/interviewProgressSync';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { resolveScenarioUserTextForBoundaryReflection } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import { buildScenarioFictionHandoffBundleWithDynamicLead } from '@features/aria/resolveScenarioBoundaryLeadForInterview';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { remoteLog } from '@utilities/remoteLog';

export type PreClaudeScenario1RepairHardStopGateResult = {
  handled: boolean;
};

function baseRepairHardStopEligible(deps: PreClaudeTurnGateDeps): boolean {
  return (
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    deps.status === 'active' &&
    !deps.closingQuestionPending &&
    deps.waitingForClosingAdditionRef.current === null
  );
}

/**
 * User refused after a repair ask — advance to Situation 2 without another model turn.
 */
function metaTurnDefersS1RepairHardStop(
  metaCommentClassification: MetaCommentClassification | null,
): boolean {
  const type = metaCommentClassification?.type;
  return type === 'inability' || type === 'skip_request';
}

export async function runPreClaudeScenario1RepairHardStopGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  lastAssistantContent: string,
  userScenarioTag: number,
  participantFirstNameForSpoken: string,
  metaCommentClassification: MetaCommentClassification | null = null,
): Promise<PreClaudeScenario1RepairHardStopGateResult> {
  if (!baseRepairHardStopEligible(deps)) {
    return { handled: false };
  }
  if (
    userScenarioTag !== 1 ||
    deps.currentInterviewMomentRef.current !== 1 ||
    !isInterviewHardStopUserTurn(trimmed) ||
    !scenarioALastAssistantIsRepairProbeOrFollowUp(lastAssistantContent) ||
    metaTurnDefersS1RepairHardStop(metaCommentClassification)
  ) {
    return { handled: false };
  }

  void remoteLog('[S1_REPAIR_HARD_STOP_ADVANCE]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    userPreview: trimmed.slice(0, 120),
    lastAssistantPreview: lastAssistantContent.slice(0, 200),
  });
  deps.interviewMomentsCompleteRef.current[1] = true;
  deps.currentInterviewMomentRef.current = 2;
  const userCorpus = resolveScenarioUserTextForBoundaryReflection(
    [...messagesToUse, { role: 'user', content: trimmed, scenarioNumber: 1 }],
    1,
  );
  const bundle = await buildScenarioFictionHandoffBundleWithDynamicLead({
    completedScenario: 1,
    firstName: participantFirstNameForSpoken,
    lastUserAnswer: userCorpus,
    interviewSessionId: deps.interviewSessionIdRef.current,
  });
  const lead = "Understood — we'll leave it there for this one. ";
  let fullDisplay = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
    sanitizeAssistantInterviewerCharacterNames(lead + bundle),
    participantFirstNameForSpoken,
  );
  fullDisplay = ensureSpokenTextIncludesParticipantFirstName(fullDisplay, participantFirstNameForSpoken, {
    allowAppendWhenMissing: true,
  });
  const newAssistantMsg: MessageWithScenario = {
    role: 'assistant',
    content: fullDisplay,
    scenarioNumber: 2,
  };
  deps.currentScenarioRef.current = 2;
  deps.resumeActiveScenarioRef.current = 2;
  const updatedMessages = [...messagesToUse, newAssistantMsg];
  deps.setMessages(updatedMessages);
  const progressRefsForS1HardStop: InterviewProgressRefs = {
    interviewMomentsCompleteRef: deps.interviewMomentsCompleteRef,
    currentInterviewMomentRef: deps.currentInterviewMomentRef,
    personalHandoffInjectedRef: deps.personalHandoffInjectedRef,
  };
  deps.applyInterviewProgressFromAssistantText(fullDisplay, progressRefsForS1HardStop);
  deps.elongatingProbeFiredRef.current = false;
  deps.setHighestScenarioReached((prev) => Math.max(prev, 1));
  if (!deps.scoredScenariosRef.current.has(1)) {
    deps.scoredScenariosRef.current.add(1);
    deps.scoreScenario(1, updatedMessages);
  }
  await deps.notifyScenarioStarted(2, updatedMessages);
  const spS1Hard = splitScenarioTransitionForEmotionModal(fullDisplay);
  try {
    await deps.speakTextSafe(spS1Hard.beforeModal, ASSISTANT_INTERVIEW_SPEECH);
  } catch {
    /* advance even if TTS fails */
  }
  await deps.runEmotionModalAfterScenarioTransition(1, {
    transitionText: fullDisplay,
    priorScenario: 1,
    afterBeforeModalPlayback: true,
  });
  if (spS1Hard.afterModal.trim()) {
    try {
      await deps.speakTextSafe(spS1Hard.afterModal, ASSISTANT_INTERVIEW_SPEECH);
    } catch {
      /* advance even if TTS fails */
    }
  } else if (__DEV__) {
    console.warn('[Amoraea] emotion modal S1→S2: missing afterModal split (S1 repair hard stop)');
  }
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  return { handled: true };
}
