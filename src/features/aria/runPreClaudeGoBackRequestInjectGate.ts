import { GO_BACK_REQUEST_DECLINE_LINE } from '@features/aria/interviewPromptInstructions';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { looksLikeGoBackToPreviousScenarioRequest } from '@features/aria/interviewGoBackRequest';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  finishPreClaudeSkipInjectionTurn,
  isPreClaudeTurnSkipInjectionRouteActive,
  scenarioTagForSkipMoment,
  type PreClaudeTurnSkipInjectionResult,
} from '@features/aria/preClaudeTurnSkipInjectionShared';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';

/**
 * Mid-interview "go back to previous scenario" asks — fixed client TTS, no Claude turn.
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

  const tag = scenarioTagForSkipMoment(deps, messagesToUse);
  const declineMsg: MessageWithScenario = {
    role: 'assistant',
    content: GO_BACK_REQUEST_DECLINE_LINE,
    scenarioNumber: tag as 1 | 2 | 3,
    interviewMoment: deps.currentInterviewMomentRef.current,
  };
  deps.setMessages([...messagesToUse, declineMsg]);
  if (deps.userId) {
    const r = getSessionLogRuntime();
    writeSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'go_back_request_declined',
      eventData: {
        moment_number: deps.currentInterviewMomentRef.current,
        scenario_number: tag,
        transcript_preview: trimmed.slice(0, 200),
        aira_response_delivered: GO_BACK_REQUEST_DECLINE_LINE,
      },
      platform: r.platform,
    });
  }
  await deps.speakTextSafe(GO_BACK_REQUEST_DECLINE_LINE, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    allowDuplicateConsecutiveTts: true,
    skipLastQuestionRef: true,
  });
  return finishPreClaudeSkipInjectionTurn(deps);
}
