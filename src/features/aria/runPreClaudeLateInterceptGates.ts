import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  resolvePreClaudeAssistantTurnContext,
} from '@features/aria/resolvePreClaudeAssistantTurnContext';
import {
  resolvePreClaudeScenarioConstructProbeFlags,
  type PreClaudeScenarioConstructProbeFlags,
} from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
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
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';

export type PreClaudeLateInterceptGatesPass = {
  handled: false;
  lastAssistantContent: string;
  lastInterviewerContent: string;
  isPersonalOpening: boolean;
  shouldForceMoment4ThresholdProbe: boolean;
  moment4ThresholdHintInAnswer: boolean;
  moment5CombinedUserText: string;
  constructProbeFlags: PreClaudeScenarioConstructProbeFlags;
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
): Promise<PreClaudeLateInterceptGatesResult> {
  const assistantTurnContext = resolvePreClaudeAssistantTurnContext(deps, trimmed, messagesToUse);
  const { lastAssistantContent, lastInterviewerContent, isPersonalOpening } = assistantTurnContext;

  // Go-back asks must decline before M4 threshold inject (which otherwise treats the ask as an answer).
  const goBackRequest = await runPreClaudeGoBackRequestInjectGate(deps, trimmed, messagesToUse);
  if (goBackRequest?.haltTurn) {
    return { handled: true };
  }

  const scoreRequest = await runPreClaudeScoreRequestInjectGate(deps, trimmed, messagesToUse);
  if (scoreRequest?.haltTurn) {
    return { handled: true };
  }

  const moment4SpecificityGate = await runPreClaudeMoment4SpecificityGate(
    deps,
    trimmed,
    messagesToUse,
    lastAssistantContent,
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

  const confusionOfferRepeat = await runPreClaudeConfusionOfferRepeatGate(
    deps,
    trimmed,
    messagesToUse,
    metaCommentClassification,
  );
  if (confusionOfferRepeat.handled) {
    return { handled: true };
  }

  const moment5QuestionInject = await runPreClaudeMoment5QuestionInjectGate(
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
  );
  if (clientOwnedCanonical.handled) {
    return { handled: true };
  }

  // Cut-off / unassessable retry is last — after score/meta/disengagement checks (e.g. "Can I see my score?").
  // Still before Claude; M5 inject stays earlier so incomplete threshold answers do not advance.
  const irrelevantAnswerRetry = await runPreClaudeIrrelevantAnswerRetryGate(
    deps,
    trimmed,
    messagesToUse,
    lastAssistantContent,
  );
  if (irrelevantAnswerRetry.handled) {
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
  };
}
