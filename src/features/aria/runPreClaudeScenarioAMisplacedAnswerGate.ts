import { isDecline } from '@features/aria/interviewControlTokens';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import {
  SCENARIO_A_MISPLACED_S2_ANSWER_REDIRECT,
  userAnswerLooksLikeMisplacedScenarioBInScenarioA,
} from '@features/aria/misplacedScenarioAnswerLogic';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  buildPreClaudeSessionSpokenDeliveryHints,
  syncInterviewScenarioRefsFromSessionState,
} from '@features/aria/interviewScenarioRefSync';
import { remoteLog } from '@utilities/remoteLog';

export type PreClaudeScenarioAMisplacedAnswerGateResult = {
  handled: boolean;
};

/**
 * User answered Situation 2 (Sarah/James) while still in Situation 1 — redirect client-side
 * so Claude cannot stream a truncated meta redirect or advance scenario refs early.
 */
export async function runPreClaudeScenarioAMisplacedAnswerGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
): Promise<PreClaudeScenarioAMisplacedAnswerGateResult> {
  syncInterviewScenarioRefsFromSessionState(deps, deps.messages, buildPreClaudeSessionSpokenDeliveryHints(deps));
  const inScenarioA =
    deps.currentScenarioRef.current === 1 && deps.currentInterviewMomentRef.current === 1;
  if (
    !inScenarioA ||
    deps.personalHandoffInjectedRef.current ||
    isDecline(trimmed) ||
    !userAnswerLooksLikeMisplacedScenarioBInScenarioA(trimmed)
  ) {
    return { handled: false };
  }

  const userMsg: MessageWithScenario = {
    role: 'user',
    content: trimmed,
    scenarioNumber: 1,
  };
  const redirectMsg: MessageWithScenario = {
    role: 'assistant',
    content: SCENARIO_A_MISPLACED_S2_ANSWER_REDIRECT,
    scenarioNumber: 1,
  };
  void remoteLog('[S1_MISPLACED_S2_ANSWER]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    answerPreview: trimmed.slice(0, 500),
  });
  deps.setMessages([...deps.messages, userMsg, redirectMsg]);
  await deps.speakTextSafe(SCENARIO_A_MISPLACED_S2_ANSWER_REDIRECT, ASSISTANT_INTERVIEW_SPEECH);
  deps.setVoiceState('idle');
  return { handled: true };
}
