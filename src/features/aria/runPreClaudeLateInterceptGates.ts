import {
  deliverClientOwnedScenario2OpeningAfterS1Repair,
  deliverClientOwnedScenario3OpeningAfterS2Repair,
} from '@features/aria/deliverClientOwnedScenarioHandoffOpening';
import { deliverMoment4CommitmentThresholdProbe } from '@features/aria/deliverMoment4CommitmentThresholdProbe';
import { scenarioALastAssistantIsRepairProbeOrFollowUp } from '@features/aria/interviewDisengagementProbes';
import {
  userAnswerSatisfiesScenarioARepairPrompt,
  userAnswerSatisfiesScenarioBJamesRepairPrompt,
} from '@features/aria/interviewRepairRefusalDetection';
import { looksLikeScenarioBRepairAsJamesQuestion } from '@features/aria/scenarioBProbeLogic';
import { transcriptIncludesMoment4ThresholdAssistant } from '@features/aria/moment4ProbeLogic';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  resolvePreClaudeAssistantTurnContext,
} from '@features/aria/resolvePreClaudeAssistantTurnContext';
import {
  resolvePreClaudeScenarioConstructProbeFlags,
  type PreClaudeScenarioConstructProbeFlags,
} from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import { runPreClaudeAlreadyAnsweredAdvanceGate } from '@features/aria/runPreClaudeAlreadyAnsweredAdvanceGate';
import { runPreClaudeCheckingInAckGate } from '@features/aria/runPreClaudeCheckingInAckGate';
import {
  runPreClaudeClientDisengagementProbeGate,
} from '@features/aria/runPreClaudeClientDisengagementProbeGate';
import {
  runPreClaudeClientOwnedCanonicalConstructGate,
} from '@features/aria/runPreClaudeClientOwnedCanonicalConstructGate';
import {
  runPreClaudeConfusionOfferRepeatGate,
} from '@features/aria/runPreClaudeConfusionOfferRepeatGate';
import {
  runPreClaudeIrrelevantAnswerRetryGate,
} from '@features/aria/runPreClaudeIrrelevantAnswerRetryGate';
import {
  runPreClaudeConfusionRepeatReplayGates,
} from '@features/aria/runPreClaudeConfusionRepeatReplayGates';
import {
  runPreClaudeOrchestratorEarlyScoreGoBackGate,
} from '@features/aria/runPreClaudeOrchestratorEarlyScoreGoBackGate';
import {
  runPreClaudeGoBackRequestInjectGate,
} from '@features/aria/runPreClaudeGoBackRequestInjectGate';
import {
  runPreClaudeScoreRequestInjectGate,
} from '@features/aria/runPreClaudeScoreRequestInjectGate';
import {
  runPreClaudeMoment4SpecificityGate,
} from '@features/aria/runPreClaudeMoment4SpecificityGate';
import {
  runPreClaudeMoment5AccountabilityInjectGates,
} from '@features/aria/runPreClaudeMoment5AccountabilityInjectGates';
import {
  runPreClaudeMoment5QuestionInjectGate,
} from '@features/aria/runPreClaudeMoment5QuestionInjectGate';
import {
  runPreClaudeScenario1RepairHardStopGate,
} from '@features/aria/runPreClaudeScenario1RepairHardStopGate';
import {
  syncMoment5ClientInjectRefsFromTranscript,
  syncMoment5PostPromptUserTurnCount,
} from '@features/aria/syncPreClaudeMoment5RefsFromTranscript';
import type { ConstructSatisfactionResolvedByProbe } from '@features/aria/interviewConstructSatisfactionLlmTypes';
import { prefetchConstructSatisfactionLlmForPendingProbe } from '@features/aria/prefetchConstructSatisfactionLlmForPendingProbe';
import { scheduleScenarioBoundaryLeadPrefetch } from '@features/aria/prefetchScenarioBoundaryLeadForUpcomingHandoff';
import {
  resolveInterviewTurnOrchestratorDecisionForTurn,
  type ResolvedInterviewTurnOrchestratorDecision,
} from '@features/aria/prefetchInterviewTurnOrchestratorLlmForTurn';
import {
  runPreClaudeMoment5ClosingGate,
} from '@features/aria/runPreClaudeMoment5ClosingGate';
import { runPreClaudeOrchestratorExecuteGate } from '@features/aria/runPreClaudeOrchestratorExecuteGate';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  INTERVIEW_TURN_ORCHESTRATOR_COLLAPSE_M4_M5_INJECT_GATES,
  INTERVIEW_TURN_ORCHESTRATOR_EXECUTE_DECISIONS_ENABLED,
  INTERVIEW_TURN_ORCHESTRATOR_PHASE2_ENABLED,
} from '@features/aria/interviewTurnOrchestratorConfig';

export type PreClaudeLateInterceptGatesPass = {
  handled: false;
  lastAssistantContent: string;
  lastInterviewerContent: string;
  isPersonalOpening: boolean;
  shouldForceMoment4ThresholdProbe: boolean;
  moment4ThresholdHintInAnswer: boolean;
  moment5CombinedUserText: string;
  constructProbeFlags: PreClaudeScenarioConstructProbeFlags;
  constructSatisfactionResolvedByProbe: ConstructSatisfactionResolvedByProbe;
  resolvedOrchestrator: ResolvedInterviewTurnOrchestratorDecision;
  orchestratorSkippedProbeId: InterviewCanonicalProbeId | null;
};

export type PreClaudeLateInterceptGatesResult = { handled: true } | PreClaudeLateInterceptGatesPass;

/** M4/M5 injects, construct probes, repair hard-stop, and client disengagement intercepts. */
export async function runPreClaudeLateInterceptGates(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  userScenarioTag: number,
  participantFirstNameForSpoken: string,
  metaCommentClassification: MetaCommentClassification | null,
  isNameEntryTurn: boolean,
  suppressForcedConstructProbesForMetaFrustration: boolean,
  checkingInFrustrationAdjacent: boolean,
): Promise<PreClaudeLateInterceptGatesResult> {
  const assistantTurnContext = resolvePreClaudeAssistantTurnContext(deps, trimmed, messagesToUse);
  const { lastAssistantContent, lastInterviewerContent, isPersonalOpening } = assistantTurnContext;

  // Go-back / score asks must decline before M4 threshold inject (which otherwise treats the ask as an answer).
  const orchestratorScoreGoBack = await runPreClaudeOrchestratorEarlyScoreGoBackGate(
    deps,
    trimmed,
    messagesToUse,
  );
  if (orchestratorScoreGoBack.handled) {
    return { handled: true };
  }

  if (!INTERVIEW_TURN_ORCHESTRATOR_EXECUTE_DECISIONS_ENABLED) {
    const goBackRequest = await runPreClaudeGoBackRequestInjectGate(deps, trimmed, messagesToUse);
    if (goBackRequest?.haltTurn) {
      return { handled: true };
    }

    const scoreRequest = await runPreClaudeScoreRequestInjectGate(deps, trimmed, messagesToUse);
    if (scoreRequest?.haltTurn) {
      return { handled: true };
    }
  }

  const orchestratorOwnsPersonalMomentDelivery =
    INTERVIEW_TURN_ORCHESTRATOR_EXECUTE_DECISIONS_ENABLED &&
    INTERVIEW_TURN_ORCHESTRATOR_COLLAPSE_M4_M5_INJECT_GATES;

  const moment4SpecificityGate = await runPreClaudeMoment4SpecificityGate(
    deps,
    trimmed,
    messagesToUse,
    lastAssistantContent,
    orchestratorOwnsPersonalMomentDelivery,
  );
  if (moment4SpecificityGate.handled) {
    return { handled: true };
  }
  const shouldForceMoment4ThresholdProbe = moment4SpecificityGate.shouldForceMoment4ThresholdProbe;
  const moment4ThresholdHintInAnswer = moment4SpecificityGate.moment4ThresholdHintInAnswer;

  const confusionRepeatReplay = await runPreClaudeConfusionRepeatReplayGates(
    deps,
    metaCommentClassification,
    messagesToUse,
    lastInterviewerContent,
    userScenarioTag,
  );
  if (confusionRepeatReplay.handled) {
    return { handled: true };
  }

  const confusionOfferRepeat =
    INTERVIEW_TURN_ORCHESTRATOR_PHASE2_ENABLED
      ? { handled: false as const }
      : await runPreClaudeConfusionOfferRepeatGate(
          deps,
          trimmed,
          messagesToUse,
          metaCommentClassification,
        );
  if (confusionOfferRepeat.handled) {
    return { handled: true };
  }

  const checkingInAckEarly = await runPreClaudeCheckingInAckGate(
    deps,
    trimmed,
    messagesToUse,
    metaCommentClassification,
    checkingInFrustrationAdjacent,
  );
  if (checkingInAckEarly.handled) {
    return { handled: true };
  }

  const alreadyAnsweredAdvance = await runPreClaudeAlreadyAnsweredAdvanceGate(
    deps,
    trimmed,
    messagesToUse,
    metaCommentClassification,
  );
  if (alreadyAnsweredAdvance.handled) {
    return { handled: true };
  }

  const cutOffRetryEarly = await runPreClaudeIrrelevantAnswerRetryGate(
    deps,
    trimmed,
    messagesToUse,
    lastAssistantContent,
    metaCommentClassification,
  );
  if (cutOffRetryEarly.handled) {
    return { handled: true };
  }

  const moment5QuestionInject = orchestratorOwnsPersonalMomentDelivery
    ? { handled: false as const }
    : await runPreClaudeMoment5QuestionInjectGate(
        deps,
        messagesToUse,
        participantFirstNameForSpoken,
      );
  if (moment5QuestionInject.handled) {
    return { handled: true };
  }

  syncMoment5PostPromptUserTurnCount(deps, lastInterviewerContent);
  syncMoment5ClientInjectRefsFromTranscript(deps, messagesToUse);

  const moment5Accountability = await runPreClaudeMoment5AccountabilityInjectGates(
    deps,
    trimmed,
    messagesToUse,
    lastInterviewerContent,
    metaCommentClassification,
  );
  const moment5CombinedUserText = moment5Accountability.moment5CombinedUserText;
  if (moment5Accountability.handled) {
    return { handled: true };
  }

  const constructProbeFlags = resolvePreClaudeScenarioConstructProbeFlags(
    deps,
    trimmed,
    messagesToUse,
    lastAssistantContent,
    lastInterviewerContent,
    suppressForcedConstructProbesForMetaFrustration,
  );

  if (
    deps.currentInterviewMomentRef.current === 1 &&
    (deps.currentScenarioRef.current ?? 1) === 1 &&
    scenarioALastAssistantIsRepairProbeOrFollowUp(lastAssistantContent) &&
    userAnswerSatisfiesScenarioARepairPrompt(trimmed, lastAssistantContent)
  ) {
    const deliveredS2AfterRepair = await deliverClientOwnedScenario2OpeningAfterS1Repair(
      deps,
      messagesToUse,
      participantFirstNameForSpoken,
    );
    if (deliveredS2AfterRepair) {
      return { handled: true };
    }
  }

  if (
    deps.currentInterviewMomentRef.current === 2 &&
    (deps.currentScenarioRef.current ?? 2) === 2 &&
    looksLikeScenarioBRepairAsJamesQuestion(lastAssistantContent) &&
    userAnswerSatisfiesScenarioBJamesRepairPrompt(trimmed, lastAssistantContent)
  ) {
    const deliveredS3AfterRepair = await deliverClientOwnedScenario3OpeningAfterS2Repair(
      deps,
      messagesToUse,
      participantFirstNameForSpoken,
    );
    if (deliveredS3AfterRepair) {
      return { handled: true };
    }
  }

  const constructSatisfactionResolvedByProbe = await prefetchConstructSatisfactionLlmForPendingProbe(
    {
      deps,
      trimmed,
      messagesToUse,
      lastAssistantContent,
      constructProbeFlags,
      suppressForcedConstructProbesForMetaFrustration,
    },
  );

  scheduleScenarioBoundaryLeadPrefetch({
    deps,
    trimmed,
    messagesToUse,
    participantFirstNameForSpoken,
  });

  const resolvedOrchestrator = await resolveInterviewTurnOrchestratorDecisionForTurn({
    deps,
    trimmed,
    messagesToUse,
    lastAssistantContent,
    constructProbeFlags,
    metaCommentClassification,
    constructSatisfactionResolvedByProbe,
  });
  const orchestratorExecute = await runPreClaudeOrchestratorExecuteGate({
    deps,
    trimmed,
    messagesToUse,
    decision: resolvedOrchestrator.decision,
    participantFirstNameForSpoken,
    suppressForcedConstructProbesForMetaFrustration,
  });

  if (
    !orchestratorExecute.handled &&
    orchestratorOwnsPersonalMomentDelivery &&
    shouldForceMoment4ThresholdProbe &&
    !deps.moment4ThresholdProbeAskedRef.current &&
    !transcriptIncludesMoment4ThresholdAssistant(messagesToUse)
  ) {
    const delivered = await deliverMoment4CommitmentThresholdProbe({
      deps,
      trimmed,
      messagesToUse,
      logTag: '[M4_COMMITMENT_THRESHOLD_ORCHESTRATOR_FALLBACK]',
    });
    if (delivered) {
      return { handled: true };
    }
  }

  if (orchestratorExecute.handled) {
    return { handled: true };
  }

  const moment5Closing = await runPreClaudeMoment5ClosingGate({
    deps,
    messagesToUse,
    moment5CombinedUserText,
    decision: resolvedOrchestrator.decision,
  });
  if (moment5Closing.handled) {
    return { handled: true };
  }

  const s1RepairHardStop = await runPreClaudeScenario1RepairHardStopGate(
    deps,
    trimmed,
    messagesToUse,
    lastAssistantContent,
    userScenarioTag,
    participantFirstNameForSpoken,
    metaCommentClassification,
  );
  if (s1RepairHardStop.handled) {
    return { handled: true };
  }

  const clientDisengagement = await runPreClaudeClientDisengagementProbeGate(
    deps,
    trimmed,
    messagesToUse,
    lastAssistantContent,
    userScenarioTag,
    metaCommentClassification,
    isNameEntryTurn,
  );
  if (clientDisengagement.handled) {
    return { handled: true };
  }

  const clientOwnedCanonical = await runPreClaudeClientOwnedCanonicalConstructGate(
    deps,
    trimmed,
    messagesToUse,
    lastAssistantContent,
    constructProbeFlags,
    suppressForcedConstructProbesForMetaFrustration,
    constructSatisfactionResolvedByProbe,
    orchestratorExecute.skippedProbeId ?? null,
  );
  if (clientOwnedCanonical.handled) {
    return { handled: true };
  }

  return {
    handled: false,
    lastAssistantContent,
    lastInterviewerContent,
    isPersonalOpening,
    shouldForceMoment4ThresholdProbe,
    moment4ThresholdHintInAnswer,
    moment5CombinedUserText,
    constructProbeFlags,
    constructSatisfactionResolvedByProbe,
    resolvedOrchestrator,
    orchestratorSkippedProbeId: orchestratorExecute.skippedProbeId ?? null,
  };
}
