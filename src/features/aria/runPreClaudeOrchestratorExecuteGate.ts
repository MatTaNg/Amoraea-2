import { deliverInterviewCanonicalProbe } from '@features/aria/deliverInterviewCanonicalProbe';
import { deliverMoment4CommitmentOrientationProbe } from '@features/aria/deliverMoment4CommitmentOrientationProbe';
import { deliverMoment4CommitmentThresholdProbe } from '@features/aria/deliverMoment4CommitmentThresholdProbe';
import { isDecline } from '@features/aria/interviewControlTokens';
import { evaluateHybridCutOffDetection } from '@features/aria/interviewCutOffDetection';
import { looksLikeUnassessableScenarioAnswer, looksLikeInterviewProcessMetaComment } from '@features/aria/interviewAnswerRelevance';
import {
  looksLikeScenarioCSophiePerspectiveAssessableShortAnswer,
  looksLikeScenarioCSophiePerspectiveQuestion,
} from '@features/aria/scenarioCPromptDetection';
import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import { INTERVIEW_TURN_ORCHESTRATOR_EXECUTE_DECISIONS_ENABLED } from '@features/aria/interviewTurnOrchestratorConfig';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { looksLikeMoment4GrudgePrompt } from '@features/aria/moment4ProbeLogic';
import { evaluateMoment4SpecificityProbe, looksLikeMoment4SpecificityFollowUpEcho } from '@features/aria/moment4SpecificityFollowUp';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { deliverMoment5ConflictProbe } from '@features/aria/deliverMoment5ConflictProbe';
import { deliverMomentSupportProbe } from '@features/aria/deliverMomentSupportProbe';
import { speakInterviewOrchestratorFixedLine } from '@features/aria/speakInterviewOrchestratorFixedLine';
import type { InterviewTurnOrchestratorDecision } from '@features/aria/interviewTurnOrchestratorTypes';
import { remoteLog } from '@utilities/remoteLog';

const SCENARIO_CANONICAL_PROBE_IDS = new Set<InterviewCanonicalProbeId>([
  's1_contempt',
  's2_james_differently',
  's3_sophie_perspective',
  's3_repair',
]);

export type PreClaudeOrchestratorExecuteGateResult = {
  handled: boolean;
  skippedProbeId?: InterviewCanonicalProbeId;
};

/**
 * Phase 5: execute orchestrator hard-rail actions before Claude — fixed lines, verbatim canonical probes, skip.
 */
export async function runPreClaudeOrchestratorExecuteGate(args: {
  deps: PreClaudeTurnGateDeps;
  trimmed: string;
  messagesToUse: MessageWithScenario[];
  decision: InterviewTurnOrchestratorDecision;
  participantFirstNameForSpoken: string;
  suppressForcedConstructProbesForMetaFrustration: boolean;
}): Promise<PreClaudeOrchestratorExecuteGateResult> {
  if (!INTERVIEW_TURN_ORCHESTRATOR_EXECUTE_DECISIONS_ENABLED) {
    return { handled: false };
  }
  const lastAssistantContent =
    [...args.messagesToUse].reverse().find((m) => m.role === 'assistant')?.content ?? '';
  const sophieAffectDespiteShortLength =
    looksLikeScenarioCSophiePerspectiveAssessableShortAnswer(args.trimmed) &&
    (looksLikeScenarioCSophiePerspectiveQuestion(args.deps.lastQuestionTextRef.current ?? '') ||
      looksLikeScenarioCSophiePerspectiveQuestion(lastAssistantContent));
  if (
    (isDecline(args.trimmed) && !sophieAffectDespiteShortLength) ||
    args.suppressForcedConstructProbesForMetaFrustration
  ) {
    return { handled: false };
  }
  if (looksLikeInterviewProcessMetaComment(args.trimmed)) {
    return { handled: false };
  }

  const { action } = args.decision;

  if (action.kind === 'speak_fixed_line') {
    const handled = await speakInterviewOrchestratorFixedLine({
      deps: args.deps,
      trimmed: args.trimmed,
      messagesToUse: args.messagesToUse,
      lineId: action.lineId,
    });
    return { handled };
  }

  if (action.kind === 'skip_probe_already_satisfied') {
    void remoteLog('[ORCHESTRATOR_EXECUTE_SKIP_PROBE]', {
      interviewSessionId: args.deps.interviewSessionIdRef.current,
      probeId: action.probeId,
      advanceToProbeId: action.advanceToProbeId ?? null,
      decisionSource: args.decision.source,
      reason: args.decision.reason,
    });
    return { handled: false, skippedProbeId: action.probeId };
  }

  if (action.kind !== 'speak_canonical') {
    return { handled: false };
  }

  const { probeId } = action;
  const cutOff = evaluateHybridCutOffDetection({
    transcriptText: args.trimmed,
    telemetry: args.deps.lastUserTurnMicStopTelemetryRef?.current ?? null,
  });
  if (
    (looksLikeUnassessableScenarioAnswer(args.trimmed) || cutOff.isCutOff) &&
    SCENARIO_CANONICAL_PROBE_IDS.has(probeId)
  ) {
    return { handled: false };
  }

  if (probeId === 'm4_commitment_orientation') {
    const specificityProbeInTranscript = args.messagesToUse.some(
      (m) =>
        m.role === 'assistant' &&
        looksLikeMoment4SpecificityFollowUpEcho((m as { content?: string }).content ?? ''),
    );
    const lastAssistantContent =
      args.messagesToUse.filter((m) => m.role === 'assistant').slice(-1)[0]?.content ?? '';
    if (
      looksLikeMoment4GrudgePrompt(lastAssistantContent) &&
      !specificityProbeInTranscript &&
      evaluateMoment4SpecificityProbe(args.trimmed).probeShouldFire
    ) {
      return { handled: false };
    }
    const delivered = await deliverMoment4CommitmentOrientationProbe({
      deps: args.deps,
      trimmed: args.trimmed,
      messagesToUse: args.messagesToUse,
      logTag: '[ORCHESTRATOR_EXECUTE_M4_ORIENTATION]',
      withBriefAck: action.withBriefAck !== false,
    });
    return { handled: delivered };
  }

  if (probeId === 'm4_commitment_threshold') {
    const delivered = await deliverMoment4CommitmentThresholdProbe({
      deps: args.deps,
      trimmed: args.trimmed,
      messagesToUse: args.messagesToUse,
      logTag: '[ORCHESTRATOR_EXECUTE_M4_THRESHOLD]',
    });
    return { handled: delivered };
  }

  if (probeId === 'm5_conflict') {
    const m5 = await deliverMoment5ConflictProbe({
      deps: args.deps,
      messagesToUse: args.messagesToUse,
      participantFirstNameForSpoken: args.participantFirstNameForSpoken,
      logTag: '[ORCHESTRATOR_EXECUTE_M5_CONFLICT]',
    });
    return { handled: m5.delivered };
  }

  if (probeId === 'm_support') {
    const delivered = await deliverMomentSupportProbe({
      deps: args.deps,
      messagesToUse: args.messagesToUse,
      logTag: '[ORCHESTRATOR_EXECUTE_M_SUPPORT]',
    });
    return { handled: delivered };
  }

  if (probeId === 'm_support_need_recognition') {
    await deliverInterviewCanonicalProbe({
      deps: args.deps,
      messagesToUse: args.messagesToUse,
      probeId,
      withBriefAck: false,
      userText: args.trimmed,
      logTag: `[ORCHESTRATOR_EXECUTE_CANONICAL_${probeId.toUpperCase()}]`,
    });
    return { handled: true };
  }

  if (probeId === 'm4_grudge') {
    return { handled: false };
  }

  if (!SCENARIO_CANONICAL_PROBE_IDS.has(probeId)) {
    return { handled: false };
  }

  await deliverInterviewCanonicalProbe({
    deps: args.deps,
    messagesToUse: args.messagesToUse,
    probeId,
    withBriefAck: action.withBriefAck,
    userText: args.trimmed,
    logTag: `[ORCHESTRATOR_EXECUTE_CANONICAL_${probeId.toUpperCase()}]`,
  });
  return { handled: true };
}
