import { buildInterviewTurnStateSnapshot } from '@features/aria/buildInterviewTurnStateSnapshot';
import { evaluateInterviewTurnOrchestratorDecision } from '@features/aria/evaluateInterviewTurnOrchestratorDecision';
import { fetchInterviewTurnOrchestratorDecisionFromLlm } from '@features/aria/fetchInterviewTurnOrchestratorDecisionFromLlm';
import type { ConstructSatisfactionResolvedByProbe } from '@features/aria/interviewConstructSatisfactionLlmTypes';
import {
  INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_LIVE_ENABLED,
  INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_LIVE_TIMEOUT_MS,
  INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_SHADOW_ENABLED,
} from '@features/aria/interviewTurnOrchestratorConfig';
import { mergeInterviewTurnOrchestratorDecisions } from '@features/aria/mergeInterviewTurnOrchestratorDecisions';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import type { InterviewTurnOrchestratorDecision } from '@features/aria/interviewTurnOrchestratorTypes';
import { scheduleInterviewTurnOrchestratorLlmShadow } from '@features/aria/scheduleInterviewTurnOrchestratorLlmShadow';
import { remoteLog } from '@utilities/remoteLog';

export type ResolvedInterviewTurnOrchestratorDecision = {
  decision: InterviewTurnOrchestratorDecision;
  heuristic: InterviewTurnOrchestratorDecision;
  resolution: 'heuristic' | 'llm_live' | 'llm_live_agrees' | 'llm_live_overrides';
};

/**
 * Heuristic v1 + optional live LLM planner prefetch (Phase 4 live).
 */
export async function resolveInterviewTurnOrchestratorDecisionForTurn(args: {
  deps: PreClaudeTurnGateDeps;
  trimmed: string;
  messagesToUse: MessageWithScenario[];
  lastAssistantContent: string;
  constructProbeFlags: PreClaudeScenarioConstructProbeFlags;
  metaCommentClassification: MetaCommentClassification | null;
  constructSatisfactionResolvedByProbe?: ConstructSatisfactionResolvedByProbe;
}): Promise<ResolvedInterviewTurnOrchestratorDecision> {
  const snapshot = buildInterviewTurnStateSnapshot(
    args.deps,
    args.trimmed,
    args.messagesToUse,
    args.lastAssistantContent,
  );
  const heuristic = evaluateInterviewTurnOrchestratorDecision({
    snapshot,
    messages: args.messagesToUse,
    constructFlags: args.constructProbeFlags,
    metaCommentClassification: args.metaCommentClassification,
    constructSatisfactionResolvedByProbe: args.constructSatisfactionResolvedByProbe,
  });

  let llm: InterviewTurnOrchestratorDecision | null = null;
  if (INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_LIVE_ENABLED) {
    try {
      llm = await fetchInterviewTurnOrchestratorDecisionFromLlm({
        snapshot,
        messages: args.messagesToUse,
        constructFlags: args.constructProbeFlags,
        metaCommentClassification: args.metaCommentClassification,
        activeQuestionPreview: heuristic.activeQuestionPreview,
        timeoutMs: INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_LIVE_TIMEOUT_MS,
      });
      void remoteLog('[INTERVIEW_TURN_ORCHESTRATOR_LLM_LIVE]', {
        interviewSessionId: args.deps.interviewSessionIdRef.current,
        moment: snapshot.currentInterviewMoment,
        scenario: snapshot.currentScenario,
        heuristicActionKind: heuristic.action.kind,
        llmActionKind: llm?.action.kind ?? null,
        resolution: llm
          ? mergeInterviewTurnOrchestratorDecisions({
              heuristic,
              llm,
              preferLlm: true,
            }).resolution
          : 'parse_fail',
      });
    } catch (err) {
      void remoteLog('[INTERVIEW_TURN_ORCHESTRATOR_LLM_LIVE_ERROR]', {
        interviewSessionId: args.deps.interviewSessionIdRef.current,
        moment: snapshot.currentInterviewMoment,
        scenario: snapshot.currentScenario,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  } else if (INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_SHADOW_ENABLED) {
    scheduleInterviewTurnOrchestratorLlmShadow({
      interviewSessionId: args.deps.interviewSessionIdRef.current,
      snapshot,
      messages: args.messagesToUse,
      constructFlags: args.constructProbeFlags,
      metaCommentClassification: args.metaCommentClassification,
      heuristicDecision: heuristic,
    });
  }

  const merged = mergeInterviewTurnOrchestratorDecisions({
    heuristic,
    llm,
    preferLlm: INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_LIVE_ENABLED && llm != null,
  });

  return {
    decision: merged.decision,
    heuristic,
    resolution: merged.resolution,
  };
}
