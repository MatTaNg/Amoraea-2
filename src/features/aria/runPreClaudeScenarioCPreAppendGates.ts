import { SCENARIO_C_MISPLACED_Q1_REDIRECT } from '@features/aria/interviewScenarioCTextHelpers';
import { isDecline } from '@features/aria/interviewControlTokens';
import { isRepairRefusalProbeAssistantLine } from '@features/aria/interviewDisengagementProbes';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  isMisplacedScenarioCQ1Answer,
  isScenarioCQ1Prompt,
  isScenarioCQ2Prompt,
} from '@features/aria/probeAndScoringUtils';
import { remoteLog } from '@utilities/remoteLog';

export type PreClaudeScenarioCPreAppendGatesResult = {
  handled: boolean;
};

function latestAssistantText(messages: PreClaudeTurnGateDeps['messages']): string {
  return [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? '';
}

/** Capture repair-only evidence before the user turn is appended (no halt). */
export function captureScenarioCRepairOnlyEvidenceIfApplicable(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
): void {
  const lastAsstScenarioCText = latestAssistantText(deps.messages);
  if (
    deps.currentScenarioRef.current === 3 &&
    !deps.personalHandoffInjectedRef.current &&
    deps.currentInterviewMomentRef.current === 3 &&
    (isScenarioCQ2Prompt(lastAsstScenarioCText) || isRepairRefusalProbeAssistantLine(lastAsstScenarioCText))
  ) {
    deps.scenarioCRepairOnlyEvidenceRef.current = trimmed;
  }
}

/**
 * Redirect misplaced Scenario C Q1 answers (interpretation vs logistics) — never send to Claude.
 */
export async function runPreClaudeScenarioCMisplacedQ1Gate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
): Promise<PreClaudeScenarioCPreAppendGatesResult> {
  const latestAssistantBeforeAppendText = latestAssistantText(deps.messages);
  const replyingToScenarioCQ1ForMisplace =
    deps.currentInterviewMomentRef.current === 3 && isScenarioCQ1Prompt(latestAssistantBeforeAppendText);
  const scenarioCQ1Misplaced =
    replyingToScenarioCQ1ForMisplace && !isDecline(trimmed) && isMisplacedScenarioCQ1Answer(trimmed);
  if (!scenarioCQ1Misplaced) {
    return { handled: false };
  }

  const userMsgMisplacedQ1: MessageWithScenario = {
    role: 'user',
    content: trimmed,
    scenarioNumber: 3,
  };
  const redirectMsgQ1: MessageWithScenario = {
    role: 'assistant',
    content: SCENARIO_C_MISPLACED_Q1_REDIRECT,
    scenarioNumber: 3,
  };
  if (__DEV__) {
    console.log('[SC3_MISPLACED_Q1]', {
      answerPreview: trimmed.slice(0, 400),
      replyingToScenarioCQ1ForMisplace,
    });
  }
  void remoteLog('[SC3_MISPLACED_Q1]', {
    phase: 'redirect_repair_logistics_instead_of_interpretation',
    interviewSessionId: deps.interviewSessionIdRef.current,
    answerPreview: trimmed.slice(0, 500),
  });
  deps.setMessages([...deps.messages, userMsgMisplacedQ1, redirectMsgQ1]);
  await deps.speakTextSafe(SCENARIO_C_MISPLACED_Q1_REDIRECT, ASSISTANT_INTERVIEW_SPEECH);
  deps.setVoiceState('idle');
  return { handled: true };
}
