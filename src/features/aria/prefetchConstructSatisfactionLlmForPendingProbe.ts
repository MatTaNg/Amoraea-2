import { buildInterviewTurnStateSnapshot } from '@features/aria/buildInterviewTurnStateSnapshot';
import { evaluateInterviewProbeConstructSatisfaction } from '@features/aria/evaluateInterviewProbeConstructSatisfaction';
import {
  constructSatisfactionLlmLiveTimeoutMs,
  fetchInterviewConstructSatisfactionFromLlm,
  recentUserTurnsForConstructSatisfaction,
} from '@features/aria/fetchInterviewConstructSatisfactionFromLlm';
import type { ConstructSatisfactionResolvedByProbe } from '@features/aria/interviewConstructSatisfactionLlmTypes';
import { resolvePendingCanonicalProbeForTurn } from '@features/aria/evaluateInterviewTurnOrchestratorDecision';
import {
  INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_LIVE_ENABLED,
  INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_SHADOW_ENABLED,
} from '@features/aria/interviewTurnOrchestratorConfig';
import { mergeProbeConstructSatisfactionWithLlm } from '@features/aria/mergeProbeConstructSatisfactionWithLlm';
import { looksLikeUnassessableScenarioAnswer } from '@features/aria/interviewAnswerRelevance';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import { scheduleInterviewConstructSatisfactionLlmShadow } from '@features/aria/scheduleInterviewConstructSatisfactionLlmShadow';
import { remoteLog } from '@utilities/remoteLog';

/**
 * When a canonical probe is pending and heuristics did not mark the construct satisfied,
 * await a short LLM check (live) before client-owned delivery — upgrades edge-case skips.
 */
export async function prefetchConstructSatisfactionLlmForPendingProbe(args: {
  deps: PreClaudeTurnGateDeps;
  trimmed: string;
  messagesToUse: MessageWithScenario[];
  lastAssistantContent: string;
  constructProbeFlags: PreClaudeScenarioConstructProbeFlags;
  suppressForcedConstructProbesForMetaFrustration: boolean;
}): Promise<ConstructSatisfactionResolvedByProbe> {
  const resolved: ConstructSatisfactionResolvedByProbe = {};
  const { deps, trimmed, messagesToUse, lastAssistantContent, constructProbeFlags } = args;

  if (args.suppressForcedConstructProbesForMetaFrustration) {
    return resolved;
  }
  if (looksLikeUnassessableScenarioAnswer(trimmed)) {
    return resolved;
  }

  const snapshot = buildInterviewTurnStateSnapshot(
    deps,
    trimmed,
    messagesToUse,
    lastAssistantContent,
  );
  const pendingProbeId = resolvePendingCanonicalProbeForTurn({
    snapshot,
    messages: messagesToUse,
    constructFlags: constructProbeFlags,
    lastAssistantContent,
  });
  if (!pendingProbeId) {
    return resolved;
  }

  const activeQuestionPreview = (
    snapshot.lastQuestionText || snapshot.lastAssistantContent
  ).slice(0, 160);

  const heuristic = evaluateInterviewProbeConstructSatisfaction({
    probeId: pendingProbeId,
    messages: messagesToUse,
    userText: trimmed,
    constructFlags: constructProbeFlags,
  });

  let llm = null;
  const needsLiveLlm =
    INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_LIVE_ENABLED &&
    !heuristic.satisfied &&
    heuristic.source !== 'transcript_delivered';

  if (needsLiveLlm) {
    const recentUserTurns = recentUserTurnsForConstructSatisfaction(
      messagesToUse,
      snapshot.currentScenario,
    );
    try {
      llm = await fetchInterviewConstructSatisfactionFromLlm({
        probeId: pendingProbeId,
        activeQuestionPreview,
        userText: trimmed,
        recentUserTurns,
        timeoutMs: constructSatisfactionLlmLiveTimeoutMs(),
      });
      void remoteLog('[INTERVIEW_CONSTRUCT_SATISFACTION_LLM_LIVE]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        probeId: pendingProbeId,
        heuristicSatisfied: heuristic.satisfied,
        llmSatisfied: llm?.satisfied ?? null,
        llmConfidence: llm?.confidence ?? null,
        agrees: llm != null ? llm.satisfied === heuristic.satisfied : null,
        resolution: llm
          ? mergeProbeConstructSatisfactionWithLlm(heuristic, llm).resolution
          : 'parse_fail',
      });
    } catch (err) {
      void remoteLog('[INTERVIEW_CONSTRUCT_SATISFACTION_LLM_LIVE_ERROR]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        probeId: pendingProbeId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  } else if (
    INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_SHADOW_ENABLED &&
    !heuristic.satisfied &&
    heuristic.source !== 'transcript_delivered'
  ) {
    scheduleInterviewConstructSatisfactionLlmShadow({
      interviewSessionId: deps.interviewSessionIdRef.current,
      probeId: pendingProbeId,
      activeQuestionPreview,
      userText: trimmed,
      messages: messagesToUse,
      currentScenario: snapshot.currentScenario,
      heuristic,
    });
  }

  resolved[pendingProbeId] = mergeProbeConstructSatisfactionWithLlm(heuristic, llm);
  return resolved;
}
