import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import {
  evaluateInterviewProbeConstructSatisfaction,
  type ProbeConstructSatisfactionResult,
} from '@features/aria/evaluateInterviewProbeConstructSatisfaction';
import { buildInterviewConstructSatisfactionLlmPrompt } from '@features/aria/interviewConstructSatisfactionLlmPrompt';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import {
  INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_SHADOW_ENABLED,
  INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_SHADOW_TIMEOUT_MS,
} from '@features/aria/interviewTurnOrchestratorConfig';
import {
  fetchInterviewConstructSatisfactionFromLlm,
  recentUserTurnsForConstructSatisfaction,
} from '@features/aria/fetchInterviewConstructSatisfactionFromLlm';
import { remoteLog } from '@utilities/remoteLog';

/**
 * Fire-and-forget LLM construct check — compares against heuristic satisfaction for telemetry.
 * Skipped when live LLM already ran for the same probe this turn.
 */
export function scheduleInterviewConstructSatisfactionLlmShadow(args: {
  interviewSessionId: string | null | undefined;
  probeId: InterviewCanonicalProbeId;
  activeQuestionPreview: string;
  userText: string;
  messages: readonly MessageWithScenario[];
  currentScenario: number;
  heuristic: ProbeConstructSatisfactionResult;
}): void {
  if (!INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_SHADOW_ENABLED) return;
  if (args.heuristic.source === 'transcript_delivered') return;

  const recentUserTurns = recentUserTurnsForConstructSatisfaction(
    args.messages,
    args.currentScenario,
  );

  void (async () => {
    try {
      const llm = await fetchInterviewConstructSatisfactionFromLlm({
        probeId: args.probeId,
        activeQuestionPreview: args.activeQuestionPreview,
        userText: args.userText,
        recentUserTurns,
        timeoutMs: INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_SHADOW_TIMEOUT_MS,
      });
      if (!llm) {
        void remoteLog('[INTERVIEW_CONSTRUCT_SATISFACTION_LLM_SHADOW_PARSE_FAIL]', {
          interviewSessionId: args.interviewSessionId,
          probeId: args.probeId,
        });
        return;
      }
      void remoteLog('[INTERVIEW_CONSTRUCT_SATISFACTION_LLM_SHADOW]', {
        interviewSessionId: args.interviewSessionId,
        probeId: args.probeId,
        heuristicSatisfied: args.heuristic.satisfied,
        heuristicSource: args.heuristic.source,
        heuristicReason: args.heuristic.reason,
        llmSatisfied: llm.satisfied,
        llmConfidence: llm.confidence,
        llmReason: llm.reason,
        agrees: llm.satisfied === args.heuristic.satisfied,
      });
    } catch (err) {
      void remoteLog('[INTERVIEW_CONSTRUCT_SATISFACTION_LLM_SHADOW_ERROR]', {
        interviewSessionId: args.interviewSessionId,
        probeId: args.probeId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}

/** Heuristic satisfaction + optional LLM shadow scheduling for a pending probe. */
export function evaluateProbeConstructSatisfactionWithShadow(args: {
  interviewSessionId: string | null | undefined;
  probeId: InterviewCanonicalProbeId;
  activeQuestionPreview: string;
  userText: string;
  messages: readonly MessageWithScenario[];
  currentScenario: number;
  constructFlags: PreClaudeScenarioConstructProbeFlags;
}): ProbeConstructSatisfactionResult {
  const heuristic = evaluateInterviewProbeConstructSatisfaction({
    probeId: args.probeId,
    messages: args.messages,
    userText: args.userText,
    constructFlags: args.constructFlags,
  });
  scheduleInterviewConstructSatisfactionLlmShadow({
    interviewSessionId: args.interviewSessionId,
    probeId: args.probeId,
    activeQuestionPreview: args.activeQuestionPreview,
    userText: args.userText,
    messages: args.messages,
    currentScenario: args.currentScenario,
    heuristic,
  });
  return heuristic;
}
