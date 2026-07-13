import { detectConstructs } from '@features/aria/interviewConstructAndScoreDisplay';
import { extractLastInterviewerMessage } from '@features/aria/interviewReferenceCardResumeHelpers';
import { isDecline } from '@features/aria/interviewControlTokens';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { looksLikeMoment4ThresholdQuestion } from '@features/aria/moment4ProbeLogic';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';

const PERSONAL_OPENING_PATTERN =
  /real (memory|example|situation|experience)|your own|from your (life|experience)|think of a time|can you think of|do you have (a|an) (example|memory)|share (a|something)|tell me about (a|something)|held a grudge|really didn't like|something a bit more personal/i;

export type PreClaudeAssistantTurnContext = {
  lastAssistantContent: string;
  lastInterviewerContent: string;
  isPersonalOpening: boolean;
};

/** Last assistant lines, construct touch tracking, and personal-opening detection. */
export function resolvePreClaudeAssistantTurnContext(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
): PreClaudeAssistantTurnContext {
  const detected = detectConstructs(trimmed);
  deps.setTouchedConstructs((prev) => [...new Set([...prev, ...detected])]);

  const lastAssistant = [...messagesToUse].reverse().find((m) => m.role === 'assistant');
  const lastAssistantContent = lastAssistant?.content ?? '';
  const lastInterviewerContent = extractLastInterviewerMessage(messagesToUse) ?? '';

  const lastContent = lastAssistantContent.toLowerCase();
  const isPersonalOpening =
    !looksLikeMoment4ThresholdQuestion(lastAssistantContent) && PERSONAL_OPENING_PATTERN.test(lastContent);
  if (isPersonalOpening && !isDecline(trimmed)) {
    deps.setUsedPersonalExamples(true);
  }

  return {
    lastAssistantContent,
    lastInterviewerContent,
    isPersonalOpening,
  };
}
