import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { SKIP_CONFIRMATION_GREETING_REOPEN_LINE } from '@features/aria/metaCommentClassification';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  finishPreClaudeSkipInjectionTurn,
  isPreClaudeTurnSkipInjectionRouteActive,
  scenarioTagForSkipMoment,
  type PreClaudeTurnSkipInjectionResult,
} from '@features/aria/preClaudeTurnSkipInjectionShared';

export async function runPreClaudeSkipConfirmationGreetingReconnectGate(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
): Promise<PreClaudeTurnSkipInjectionResult | null> {
  if (!isPreClaudeTurnSkipInjectionRouteActive(deps)) {
    return null;
  }

  const tagGre = scenarioTagForSkipMoment(deps, messagesToUse);
  const tagForMsg = (tagGre >= 1 && tagGre <= 3 ? tagGre : 1) as 1 | 2 | 3;
  const reopenMsg: MessageWithScenario = {
    role: 'assistant',
    content: SKIP_CONFIRMATION_GREETING_REOPEN_LINE,
    scenarioNumber: tagForMsg,
  };
  deps.setMessages([...messagesToUse, reopenMsg]);
  await deps.speakTextSafe(SKIP_CONFIRMATION_GREETING_REOPEN_LINE, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    allowDuplicateConsecutiveTts: true,
    skipLastQuestionRef: true,
  });
  return finishPreClaudeSkipInjectionTurn(deps);
}
