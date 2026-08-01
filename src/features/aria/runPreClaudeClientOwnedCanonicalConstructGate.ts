import { isDecline } from '@features/aria/interviewControlTokens';
import {
  looksLikeInterviewProcessMetaComment,
  looksLikeUnassessableScenarioAnswer,
} from '@features/aria/interviewAnswerRelevance';
import { deliverInterviewCanonicalProbe } from '@features/aria/deliverInterviewCanonicalProbe';
import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from '@features/aria/scenarioAContemptProbeTtsStrip';
import {
  lastAssistantPromptIsScenarioBQ1OrPrematureRedirect,
  isDeliveredScenarioBJamesDifferentlyProbe,
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import {
  shouldDeliverScenarioFollowUpQuestion,
  transcriptContainsScenarioAContemptProbe,
} from '@features/aria/scenarioFollowUpTranscriptGuard';
import {
  looksLikeScenarioCSophiePerspectiveAssessableShortAnswer,
  looksLikeScenarioCSophiePerspectiveQuestion,
} from '@features/aria/scenarioCPromptDetection';
import { looksLikeScenarioAContemptProbeAssessableShortAnswer } from '@features/aria/scenarioAContemptProbeCoverage';
import { looksLikeScenarioAContemptProbeQuestion } from '@features/aria/scenarioAContemptProbeLogic';
import { remoteLog } from '@utilities/remoteLog';
import type { ConstructSatisfactionResolvedByProbe } from '@features/aria/interviewConstructSatisfactionLlmTypes';
import { shouldPhase3SkipClientOwnedCanonicalProbe } from '@features/aria/shouldPhase3SkipClientOwnedCanonicalProbe';

export type PreClaudeClientOwnedCanonicalConstructGateResult = {
  handled: boolean;
};

function phase3SkipLogTag(probeId: InterviewCanonicalProbeId): string {
  return `[PHASE3_SKIP_CLIENT_CANONICAL_${probeId.toUpperCase()}]`;
}

async function maybeSkipForPhase3ConstructSatisfaction(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  constructProbeFlags: PreClaudeScenarioConstructProbeFlags,
  probeId: InterviewCanonicalProbeId,
  constructSatisfactionResolvedByProbe?: ConstructSatisfactionResolvedByProbe,
  orchestratorSkippedProbeId?: InterviewCanonicalProbeId | null,
): Promise<boolean> {
  if (orchestratorSkippedProbeId === probeId) {
    void remoteLog(phase3SkipLogTag(probeId), {
      interviewSessionId: deps.interviewSessionIdRef.current,
      source: 'orchestrator_execute_skip',
      reason: 'orchestrator_skip_probe_already_satisfied',
      userPreview: trimmed.slice(0, 200),
    });
    return true;
  }
  const skip = shouldPhase3SkipClientOwnedCanonicalProbe({
    probeId,
    trimmed,
    messagesToUse,
    constructProbeFlags,
    constructSatisfactionResolvedByProbe,
  });
  if (!skip) return false;
  void remoteLog(phase3SkipLogTag(probeId), {
    interviewSessionId: deps.interviewSessionIdRef.current,
    source: skip.source,
    reason: skip.reason,
    userPreview: trimmed.slice(0, 200),
  });
  return true;
}

async function deliverClientOwnedProbeIfEligible(args: {
  deps: PreClaudeTurnGateDeps;
  trimmed: string;
  messagesToUse: MessageWithScenario[];
  constructProbeFlags: PreClaudeScenarioConstructProbeFlags;
  constructSatisfactionResolvedByProbe?: ConstructSatisfactionResolvedByProbe;
  orchestratorSkippedProbeId?: InterviewCanonicalProbeId | null;
  probeId: InterviewCanonicalProbeId;
  eligible: boolean;
  logTag: string;
  withBriefAck?: boolean;
}): Promise<boolean> {
  if (!args.eligible) return false;
  if (
    await maybeSkipForPhase3ConstructSatisfaction(
      args.deps,
      args.trimmed,
      args.messagesToUse,
      args.constructProbeFlags,
      args.probeId,
      args.constructSatisfactionResolvedByProbe,
      args.orchestratorSkippedProbeId,
    )
  ) {
    return false;
  }
  await deliverInterviewCanonicalProbe({
    deps: args.deps,
    messagesToUse: args.messagesToUse,
    probeId: args.probeId,
    withBriefAck: args.withBriefAck,
    userText: args.trimmed,
    logTag: args.logTag,
  });
  return true;
}

/**
 * Fixed scripted construct probes (S1 contempt/repair, S2 James Q2/Q3) never change —
 * deliver them client-side and skip Claude so paraphrases cannot leak into TTS.
 * Fallback when orchestrator execute did not handle the turn (e.g. route_to_claude).
 */
export async function runPreClaudeClientOwnedCanonicalConstructGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  lastAssistantContent: string,
  constructProbeFlags: PreClaudeScenarioConstructProbeFlags,
  suppressForcedConstructProbesForMetaFrustration = false,
  constructSatisfactionResolvedByProbe: ConstructSatisfactionResolvedByProbe = {},
  orchestratorSkippedProbeId: InterviewCanonicalProbeId | null = null,
): Promise<PreClaudeClientOwnedCanonicalConstructGateResult> {
  if (isDecline(trimmed) || suppressForcedConstructProbesForMetaFrustration) {
    return { handled: false };
  }
  if (looksLikeInterviewProcessMetaComment(trimmed)) {
    return { handled: false };
  }
  const questionToAssess =
    (deps.lastQuestionTextRef.current ?? '').trim() || lastAssistantContent.trim();
  const contemptProbeShortAnswer =
    (looksLikeScenarioAContemptProbeQuestion(questionToAssess) ||
      looksLikeScenarioAContemptProbeQuestion(lastAssistantContent)) &&
    looksLikeScenarioAContemptProbeAssessableShortAnswer(trimmed);
  const sophiePerspectiveShortAnswer =
    (looksLikeScenarioCSophiePerspectiveQuestion(questionToAssess) ||
      looksLikeScenarioCSophiePerspectiveQuestion(lastAssistantContent)) &&
    looksLikeScenarioCSophiePerspectiveAssessableShortAnswer(trimmed);
  if (
    looksLikeUnassessableScenarioAnswer(trimmed) &&
    !contemptProbeShortAnswer &&
    !sophiePerspectiveShortAnswer
  ) {
    return { handled: false };
  }

  const {
    shouldForceScenarioAContemptProbe,
    allowScenarioARepairAfterContemptAnswer,
    shouldForceScenarioBJamesRepairProbe,
    shouldForceScenarioCSophiePerspectiveProbe,
  } = constructProbeFlags;

  if (
    await deliverClientOwnedProbeIfEligible({
      deps,
      trimmed,
      messagesToUse,
      constructProbeFlags,
      constructSatisfactionResolvedByProbe,
      orchestratorSkippedProbeId,
      probeId: 's1_contempt',
      eligible:
        shouldForceScenarioAContemptProbe &&
        shouldDeliverScenarioFollowUpQuestion(messagesToUse, SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY) &&
        !transcriptContainsScenarioAContemptProbe(messagesToUse),
      logTag: '[S1_CONTEMPT_CLIENT_OWNED_SKIP_CLAUDE]',
    })
  ) {
    return { handled: true };
  }

  if (
    await deliverClientOwnedProbeIfEligible({
      deps,
      trimmed,
      messagesToUse,
      constructProbeFlags,
      constructSatisfactionResolvedByProbe,
      orchestratorSkippedProbeId,
      probeId: 's1_repair',
      eligible:
        allowScenarioARepairAfterContemptAnswer &&
        shouldDeliverScenarioFollowUpQuestion(
          messagesToUse,
          SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
        ),
      logTag: '[S1_REPAIR_CLIENT_OWNED_SKIP_CLAUDE]',
    })
  ) {
    return { handled: true };
  }

  const answeringScenarioBQ1 =
    deps.currentInterviewMomentRef.current === 2 &&
    lastAssistantPromptIsScenarioBQ1OrPrematureRedirect(lastAssistantContent);
  const transcriptHasJamesDifferently = messagesToUse.some(
    (m) =>
      m.role === 'assistant' &&
      isDeliveredScenarioBJamesDifferentlyProbe(m.content ?? ''),
  );
  const needsJamesDifferently =
    (answeringScenarioBQ1 || constructProbeFlags.replyingToScenarioBQ1) &&
    !transcriptHasJamesDifferently &&
    shouldDeliverScenarioFollowUpQuestion(messagesToUse, SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);

  if (
    await deliverClientOwnedProbeIfEligible({
      deps,
      trimmed,
      messagesToUse,
      constructProbeFlags,
      constructSatisfactionResolvedByProbe,
      orchestratorSkippedProbeId,
      probeId: 's2_james_differently',
      eligible: needsJamesDifferently,
      logTag: '[S2_JAMES_DIFF_CLIENT_OWNED_SKIP_CLAUDE]',
      withBriefAck: true,
    })
  ) {
    return { handled: true };
  }

  if (
    await deliverClientOwnedProbeIfEligible({
      deps,
      trimmed,
      messagesToUse,
      constructProbeFlags,
      constructSatisfactionResolvedByProbe,
      orchestratorSkippedProbeId,
      probeId: 's2_james_repair',
      eligible:
        shouldForceScenarioBJamesRepairProbe &&
        shouldDeliverScenarioFollowUpQuestion(messagesToUse, SCENARIO_B_JAMES_REPAIR_CANONICAL),
      logTag: '[S2_JAMES_REPAIR_CLIENT_OWNED_SKIP_CLAUDE]',
      withBriefAck: true,
    })
  ) {
    return { handled: true };
  }

  if (
    await deliverClientOwnedProbeIfEligible({
      deps,
      trimmed,
      messagesToUse,
      constructProbeFlags,
      constructSatisfactionResolvedByProbe,
      orchestratorSkippedProbeId,
      probeId: 's3_sophie_perspective',
      eligible:
        shouldForceScenarioCSophiePerspectiveProbe &&
        shouldDeliverScenarioFollowUpQuestion(messagesToUse, SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE),
      logTag: '[S3_SOPHIE_CLIENT_OWNED_SKIP_CLAUDE]',
      withBriefAck: true,
    })
  ) {
    return { handled: true };
  }

  return { handled: false };
}
