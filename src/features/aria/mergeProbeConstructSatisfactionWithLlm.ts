import type { ProbeConstructSatisfactionResult } from '@features/aria/evaluateInterviewProbeConstructSatisfaction';
import type {
  ConstructSatisfactionLlmResult,
  ResolvedProbeConstructSatisfaction,
} from '@features/aria/interviewConstructSatisfactionLlmTypes';
import { INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_LIVE_MIN_CONFIDENCE } from '@features/aria/interviewTurnOrchestratorConfig';

/**
 * Merge heuristic construct satisfaction with an optional live LLM verdict.
 * Heuristic satisfied → fast path (no LLM needed). LLM can upgrade false→true when confident.
 */
export function mergeProbeConstructSatisfactionWithLlm(
  heuristic: ProbeConstructSatisfactionResult,
  llm: ConstructSatisfactionLlmResult | null,
): ResolvedProbeConstructSatisfaction {
  if (heuristic.satisfied) {
    return {
      ...heuristic,
      llm,
      resolution: llm ? 'heuristic' : 'heuristic',
    };
  }

  if (!llm) {
    return {
      ...heuristic,
      llm: null,
      resolution: 'llm_skipped',
    };
  }

  const confident = llm.confidence >= INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_LIVE_MIN_CONFIDENCE;

  if (confident && llm.satisfied) {
    return {
      satisfied: true,
      source: 'llm_live',
      reason: llm.reason || 'llm_construct_satisfied',
      llm,
      resolution: 'llm_live',
    };
  }

  if (confident && !llm.satisfied) {
    return {
      ...heuristic,
      llm,
      resolution: 'llm_live_not_satisfied',
    };
  }

  return {
    ...heuristic,
    llm,
    resolution: 'heuristic_fallback',
  };
}

/** Whether Phase 3 should skip canonical delivery based on merged resolution. */
export function resolvedProbeConstructShouldSkip(
  resolved: ResolvedProbeConstructSatisfaction,
): boolean {
  if (!resolved.satisfied) return false;
  if (resolved.source === 'transcript_delivered') return false;
  return true;
}
