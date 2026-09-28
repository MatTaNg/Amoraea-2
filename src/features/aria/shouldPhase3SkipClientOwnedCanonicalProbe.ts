import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import {
  evaluateInterviewProbeConstructSatisfaction,
  type ProbeConstructSatisfactionResult,
} from '@features/aria/evaluateInterviewProbeConstructSatisfaction';
import type { ConstructSatisfactionResolvedByProbe } from '@features/aria/interviewConstructSatisfactionLlmTypes';
import { INTERVIEW_TURN_ORCHESTRATOR_PHASE3_ENABLED } from '@features/aria/interviewTurnOrchestratorConfig';
import {
  resolvedProbeConstructShouldSkip,
} from '@features/aria/mergeProbeConstructSatisfactionWithLlm';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';

/**
 * Phase 3: when the construct behind a pending canonical probe is already satisfied
 * in the transcript (heuristic or live LLM), skip client-owned verbatim delivery.
 */
export function shouldPhase3SkipClientOwnedCanonicalProbe(args: {
  probeId: InterviewCanonicalProbeId;
  trimmed: string;
  messagesToUse: MessageWithScenario[];
  constructProbeFlags: PreClaudeScenarioConstructProbeFlags;
  constructSatisfactionResolvedByProbe?: ConstructSatisfactionResolvedByProbe;
}): ProbeConstructSatisfactionResult | null {
  if (!INTERVIEW_TURN_ORCHESTRATOR_PHASE3_ENABLED) return null;

  const resolved = args.constructSatisfactionResolvedByProbe?.[args.probeId];
  if (resolved && resolvedProbeConstructShouldSkip(resolved)) {
    return {
      satisfied: resolved.satisfied,
      source: resolved.source,
      reason: resolved.reason,
    };
  }

  const result = evaluateInterviewProbeConstructSatisfaction({
    probeId: args.probeId,
    messages: args.messagesToUse,
    userText: args.trimmed,
    constructFlags: args.constructProbeFlags,
  });
  if (!result.satisfied) return null;
  if (result.source === 'transcript_delivered') return null;
  return result;
}
