import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { applyMoment4PersonalQuestionReferenceCard } from '@features/aria/interviewReferenceCardResumeHelpers';
import {
  looksLikeMomentSupportNoSituationHypothetical,
  looksLikeMomentSupportQuestion,
  MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_SPOKEN,
  MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_TEXT,
  transcriptIncludesAssistantMatch,
  userLacksLivedSupportSituation,
} from '@features/aria/moment4ProbeLogic';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { markQuestionDelivered } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';

export type PreClaudeSupportNoSituationHypotheticalResult = {
  handled: boolean;
};

function latestAssistantText(messages: PreClaudeTurnGateDeps['messages']): string {
  return [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? '';
}

/**
 * Support question expects a lived example. If the participant has none, ask the hypothetical
 * instead of treating the turn as a failed answer.
 */
export async function runPreClaudeSupportNoSituationHypotheticalGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
): Promise<PreClaudeSupportNoSituationHypotheticalResult> {
  if (!deps.isInterviewAppRoute || deps.isAdmin || deps.status !== 'active') {
    return { handled: false };
  }
  const lastAssistant = latestAssistantText(deps.messages);
  if (!looksLikeMomentSupportQuestion(lastAssistant)) return { handled: false };
  if (looksLikeMomentSupportNoSituationHypothetical(lastAssistant)) return { handled: false };
  if (!userLacksLivedSupportSituation(trimmed)) return { handled: false };
  if (
    transcriptIncludesAssistantMatch(deps.messages, looksLikeMomentSupportNoSituationHypothetical)
  ) {
    return { handled: false };
  }

  const userMsg: MessageWithScenario = {
    role: 'user',
    content: trimmed,
    interviewMoment: 4,
  };
  const hypotheticalMsg: MessageWithScenario = {
    role: 'assistant',
    content: MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_SPOKEN,
    interviewMoment: 4,
  };
  void remoteLog('[M_SUPPORT_NO_SITUATION_HYPOTHETICAL]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    answerPreview: trimmed.slice(0, 300),
  });
  deps.setMessages([...deps.messages, userMsg, hypotheticalMsg]);
  applyMoment4PersonalQuestionReferenceCard(deps, MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_TEXT);
  if (deps.lastQuestionTextRef) {
    deps.lastQuestionTextRef.current = MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_TEXT;
  }
  await deps.speakTextSafe(MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_SPOKEN, ASSISTANT_INTERVIEW_SPEECH);
  markQuestionDelivered(new Date().toISOString());
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  return { handled: true };
}
