import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import type { ProbeConstructSatisfactionResult } from '@features/aria/evaluateInterviewProbeConstructSatisfaction';

export type ConstructSatisfactionLlmResult = {
  satisfied: boolean;
  confidence: number;
  reason: string;
};

export type ResolvedProbeConstructSatisfaction = ProbeConstructSatisfactionResult & {
  llm: ConstructSatisfactionLlmResult | null;
  resolution:
    | 'heuristic'
    | 'llm_live'
    | 'llm_live_not_satisfied'
    | 'heuristic_fallback'
    | 'llm_skipped';
};

export type ConstructSatisfactionResolvedByProbe = Partial<
  Record<InterviewCanonicalProbeId, ResolvedProbeConstructSatisfaction>
>;
