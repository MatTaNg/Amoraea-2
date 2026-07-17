import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { INABILITY_SKIP_CONFIRMATION_PROMPT_LINE } from '@features/aria/metaCommentClassification';
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
  const prevInability = deps.inabilityCountByMomentRef.current[momentEs] ?? 0;
  deps.inabilityCountByMomentRef.current = {
    ...deps.inabilityCountByMomentRef.current,
    [momentEs]: Math.max(1, prevInability + 1),
  };
  const escMsg: MessageWithScenario = {
    role: 'assistant',
    content: INABILITY_SKIP_CONFIRMATION_PROMPT_LINE,
    scenarioNumber: tagEs as 1 | 2 | 3,
  };
  deps.setMessages([...messagesToUse, escMsg]);
  await deps.speakTextSafe(INABILITY_SKIP_CONFIRMATION_PROMPT_LINE, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    allowDuplicateConsecutiveTts: true,
    skipLastQuestionRef: true,
  });
  return finishPreClaudeSkipInjectionTurn(deps);
}
