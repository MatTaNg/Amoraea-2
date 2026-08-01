import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { looksLikeGoBackToPreviousScenarioRequest } from '@features/aria/interviewGoBackRequest';
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
export async function runPreClaudeGoBackRequestInjectGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
): Promise<PreClaudeTurnSkipInjectionResult | null> {
  if (!isPreClaudeTurnSkipInjectionRouteActive(deps)) {
    return null;
  }
  if (!looksLikeGoBackToPreviousScenarioRequest(trimmed)) {
    return null;
  }

  const handled = await speakInterviewOrchestratorFixedLine({
    deps,
    trimmed,
    messagesToUse,
    lineId: 'go_back_decline',
  });
  if (!handled) {
    return null;
  }
  return finishPreClaudeSkipInjectionTurn(deps);
}
