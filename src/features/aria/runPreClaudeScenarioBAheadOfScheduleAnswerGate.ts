import { isDecline } from '@features/aria/interviewControlTokens';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import {
  chooseBriefScenarioAck,
  recentAssistantMessagesForAck,
} from '@features/aria/interviewReflectionAckVariation';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  lastAssistantPromptIsScenarioBQ1OrPrematureRedirect,
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
  scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent,
  userAnswerLooksLikeAheadOfScheduleScenarioBOnQ1,
  userAnswerLooksLikeAheadOfScheduleScenarioBJamesDifferentlyOnQ1,
} from '@features/aria/scenarioBProbeLogic';
import { remoteLog } from '@utilities/remoteLog';

export type PreClaudeScenarioBAheadOfScheduleAnswerGateResult = {
  handled: boolean;
};

function latestAssistantText(messages: PreClaudeTurnGateDeps['messages']): string {
  return [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? '';
}

function buildScenarioBAheadOfScheduleAcceptanceResponse(
  userAnswer: string,
  messages: readonly MessageWithScenario[],
): string {
  const ack = chooseBriefScenarioAck(recentAssistantMessagesForAck([...messages]));
  if (scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(userAnswer)) {
    return `${ack} ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`;
  }
  if (userAnswerLooksLikeAheadOfScheduleScenarioBJamesDifferentlyOnQ1(userAnswer)) {
    return `${ack} ${SCENARIO_B_JAMES_REPAIR_CANONICAL}`;
  }
  return `${ack} ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`;
}

/**
 * User answered a later Scenario B construct while still on Q1 — accept client-side and
 * advance to the next mandatory beat instead of redirecting back to mentalizing.
 */
export async function runPreClaudeScenarioBAheadOfScheduleAnswerGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
): Promise<PreClaudeScenarioBAheadOfScheduleAnswerGateResult> {
  const inScenarioB =
    deps.currentScenarioRef.current === 2 && deps.currentInterviewMomentRef.current === 2;
  const latestAssistant = latestAssistantText(deps.messages);
  const replyingToScenarioBQ1 = lastAssistantPromptIsScenarioBQ1OrPrematureRedirect(latestAssistant);
  const aheadOfSchedule =
    replyingToScenarioBQ1 && !isDecline(trimmed) && userAnswerLooksLikeAheadOfScheduleScenarioBOnQ1(trimmed);

  if (!inScenarioB || !aheadOfSchedule) {
    return { handled: false };
  }

  const response = buildScenarioBAheadOfScheduleAcceptanceResponse(trimmed, deps.messages);
  const userMsg: MessageWithScenario = {
    role: 'user',
    content: trimmed,
    scenarioNumber: 2,
  };
  const assistantMsg: MessageWithScenario = {
    role: 'assistant',
    content: response,
    scenarioNumber: 2,
  };

  void remoteLog('[S2_AHEAD_OF_SCHEDULE_ACCEPTED]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    answerPreview: trimmed.slice(0, 500),
    nextPromptPreview: response.slice(0, 220),
    priorAssistantPreview: latestAssistant.slice(0, 220),
  });

  deps.setMessages([...deps.messages, userMsg, assistantMsg]);
  await deps.speakTextSafe(response, ASSISTANT_INTERVIEW_SPEECH);
  deps.setVoiceState('idle');
  return { handled: true };
}
