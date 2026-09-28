import type { InterviewFixedLineId } from '@features/aria/interviewCanonicalProbeRegistry';
import { looksLikeGoBackToPreviousScenarioRequest } from '@features/aria/interviewGoBackRequest';
import { looksLikeInterviewScoreStatusRequest } from '@features/aria/interviewScoreStatusRequest';
import { INTERVIEW_TURN_ORCHESTRATOR_EXECUTE_DECISIONS_ENABLED } from '@features/aria/interviewTurnOrchestratorConfig';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { speakInterviewOrchestratorFixedLine } from '@features/aria/speakInterviewOrchestratorFixedLine';

/**
 * Score / go-back declines via orchestrator execute — runs before M4 inject so meta asks
 * are not misread as grudge answers.
 */
export async function runPreClaudeOrchestratorEarlyScoreGoBackGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
): Promise<{ handled: boolean }> {
  if (!INTERVIEW_TURN_ORCHESTRATOR_EXECUTE_DECISIONS_ENABLED) {
    return { handled: false };
  }

  let lineId: InterviewFixedLineId | null = null;
  if (looksLikeGoBackToPreviousScenarioRequest(trimmed)) {
    lineId = 'go_back_decline';
  } else if (looksLikeInterviewScoreStatusRequest(trimmed)) {
    lineId = 'score_decline';
  }
  if (!lineId) {
    return { handled: false };
  }

  const handled = await speakInterviewOrchestratorFixedLine({
    deps,
    trimmed,
    messagesToUse,
    lineId,
  });
  return { handled };
}
