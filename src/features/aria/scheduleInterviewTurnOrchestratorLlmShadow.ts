import { compareInterviewTurnOrchestratorDecisions } from '@features/aria/compareInterviewTurnOrchestratorDecisions';
import { fetchInterviewTurnOrchestratorDecisionFromLlm } from '@features/aria/fetchInterviewTurnOrchestratorDecisionFromLlm';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import type {
  InterviewTurnOrchestratorDecision,
  InterviewTurnStateSnapshot,
} from '@features/aria/interviewTurnOrchestratorTypes';
import {
  INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_SHADOW_ENABLED,
  INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_SHADOW_TIMEOUT_MS,
} from '@features/aria/interviewTurnOrchestratorConfig';
import { remoteLog } from '@utilities/remoteLog';

/**
 * Fire-and-forget full-turn LLM planner — compares against heuristic v1 for telemetry.
 * Does not affect live interview behavior (Phase 4 shadow only).
 */
export function scheduleInterviewTurnOrchestratorLlmShadow(args: {
  interviewSessionId: string | null | undefined;
  snapshot: InterviewTurnStateSnapshot;
  messages: readonly MessageWithScenario[];
  constructFlags: PreClaudeScenarioConstructProbeFlags;
  metaCommentClassification: MetaCommentClassification | null;
  heuristicDecision: InterviewTurnOrchestratorDecision;
}): void {
  if (!INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_SHADOW_ENABLED) return;

  void (async () => {
    try {
      const llm = await fetchInterviewTurnOrchestratorDecisionFromLlm({
        snapshot: args.snapshot,
        messages: args.messages,
        constructFlags: args.constructFlags,
        metaCommentClassification: args.metaCommentClassification,
        activeQuestionPreview: args.heuristicDecision.activeQuestionPreview,
        timeoutMs: INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_SHADOW_TIMEOUT_MS,
      });
      if (!llm) {
        void remoteLog('[INTERVIEW_TURN_ORCHESTRATOR_LLM_SHADOW_PARSE_FAIL]', {
          interviewSessionId: args.interviewSessionId,
          moment: args.snapshot.currentInterviewMoment,
          scenario: args.snapshot.currentScenario,
        });
        return;
      }

      const comparison = compareInterviewTurnOrchestratorDecisions(args.heuristicDecision, llm);
      void remoteLog('[INTERVIEW_TURN_ORCHESTRATOR_LLM_SHADOW]', {
        interviewSessionId: args.interviewSessionId,
        moment: args.snapshot.currentInterviewMoment,
        scenario: args.snapshot.currentScenario,
        heuristicActionKind: args.heuristicDecision.action.kind,
        llmActionKind: llm.action.kind,
        heuristicUserIntent: args.heuristicDecision.userIntent,
        llmUserIntent: llm.userIntent,
        heuristicPendingProbeId: args.heuristicDecision.pendingProbeId,
        llmPendingProbeId: llm.pendingProbeId,
        heuristicReason: args.heuristicDecision.reason,
        llmReason: llm.reason,
        ...comparison,
      });
    } catch (err) {
      void remoteLog('[INTERVIEW_TURN_ORCHESTRATOR_LLM_SHADOW_ERROR]', {
        interviewSessionId: args.interviewSessionId,
        moment: args.snapshot.currentInterviewMoment,
        scenario: args.snapshot.currentScenario,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}
