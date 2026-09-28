import type { InterviewTurnOrchestratorDecision } from '@features/aria/interviewTurnOrchestratorTypes';
import { compareInterviewTurnOrchestratorDecisions } from '@features/aria/compareInterviewTurnOrchestratorDecisions';

/**
 * Live Phase 4: prefer LLM planner when parsed; heuristic remains fallback on timeout/parse fail.
 */
export function mergeInterviewTurnOrchestratorDecisions(args: {
  heuristic: InterviewTurnOrchestratorDecision;
  llm: InterviewTurnOrchestratorDecision | null;
  preferLlm: boolean;
}): {
  decision: InterviewTurnOrchestratorDecision;
  resolution: 'heuristic' | 'llm_live' | 'llm_live_agrees' | 'llm_live_overrides';
  comparison: ReturnType<typeof compareInterviewTurnOrchestratorDecisions> | null;
} {
  if (!args.preferLlm || args.llm == null) {
    return { decision: args.heuristic, resolution: 'heuristic', comparison: null };
  }

  const comparison = compareInterviewTurnOrchestratorDecisions(args.heuristic, args.llm);
  if (comparison.fullyAgrees) {
    return {
      decision: { ...args.llm, source: 'llm_v1' },
      resolution: 'llm_live_agrees',
      comparison,
    };
  }

  return {
    decision: { ...args.llm, source: 'llm_v1' },
    resolution: 'llm_live_overrides',
    comparison,
  };
}
