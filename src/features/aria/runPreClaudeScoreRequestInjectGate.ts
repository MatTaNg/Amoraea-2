import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { looksLikeInterviewScoreStatusRequest } from '@features/aria/interviewScoreStatusRequest';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  finishPreClaudeSkipInjectionTurn,
  isPreClaudeTurnSkipInjectionRouteActive,
  type PreClaudeTurnSkipInjectionResult,
} from '@features/aria/preClaudeTurnSkipInjectionShared';
import { speakInterviewOrchestratorFixedLine } from '@features/aria/speakInterviewOrchestratorFixedLine';

/**
 * Legacy bisect path when orchestrator execute is disabled — delegates to shared fixed-line delivery.
 */
export async function runPreClaudeScoreRequestInjectGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
): Promise<PreClaudeTurnSkipInjectionResult | null> {
  if (!isPreClaudeTurnSkipInjectionRouteActive(deps)) {
    return null;
  }
  if (!looksLikeInterviewScoreStatusRequest(trimmed)) {
    return null;
  }

  const handled = await speakInterviewOrchestratorFixedLine({
    deps,
    trimmed,
    messagesToUse,
    lineId: 'score_decline',
  });
  if (!handled) {
    return null;
  }
  return finishPreClaudeSkipInjectionTurn(deps);
}
