import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { SKIP_REQUEST_CONFIRMATION_PROMPT_LINE } from '@features/aria/metaCommentClassification';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  finishPreClaudeSkipInjectionTurn,
  isPreClaudeTurnSkipInjectionRouteActive,
  scenarioTagForSkipMoment,
  type PreClaudeTurnSkipInjectionResult,
} from '@features/aria/preClaudeTurnSkipInjectionShared';

export async function runPreClaudeInabilityEscalationSkipGate(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
): Promise<PreClaudeTurnSkipInjectionResult | null> {
  if (!isPreClaudeTurnSkipInjectionRouteActive(deps)) {
    return null;
  }

  const tagEs = scenarioTagForSkipMoment(deps, messagesToUse);
  const momentEs = deps.currentInterviewMomentRef.current;
  deps.scenarioSkipOfferSourceRef.current = 'inability_escalation';
  deps.frustrationSkipOfferPendingRef.current = true;
  deps.frustrationSkipAwaitingConfirmationRef.current = true;
  deps.frustrationSkipHadPriorAnswerRef.current = false;
  deps.inabilityCountByMomentRef.current = {
    ...deps.inabilityCountByMomentRef.current,
    [momentEs]: 2,
  };
  const escMsg: MessageWithScenario = {
    role: 'assistant',
    content: SKIP_REQUEST_CONFIRMATION_PROMPT_LINE,
    scenarioNumber: tagEs as 1 | 2 | 3,
  };
  deps.setMessages([...messagesToUse, escMsg]);
  await deps.speakTextSafe(SKIP_REQUEST_CONFIRMATION_PROMPT_LINE, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    allowDuplicateConsecutiveTts: true,
  });
  return finishPreClaudeSkipInjectionTurn(deps);
}
