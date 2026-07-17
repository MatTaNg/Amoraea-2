import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { FRUSTRATION_SKIP_DECLINE_ENCOURAGEMENT_LINE } from '@features/aria/metaCommentClassification';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  finishPreClaudeSkipInjectionTurn,
  isPreClaudeTurnSkipInjectionRouteActive,
  scenarioTagForSkipMoment,
  type PreClaudeTurnSkipInjectionResult,
} from '@features/aria/preClaudeTurnSkipInjectionShared';

export async function runPreClaudeFrustrationSkipDeclineGate(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
): Promise<PreClaudeTurnSkipInjectionResult | null> {
  if (!isPreClaudeTurnSkipInjectionRouteActive(deps)) {
    return null;
  }

  const tag = scenarioTagForSkipMoment(deps, messagesToUse);
  const momentNumDecline = deps.currentInterviewMomentRef.current;
  deps.frustrationSkipOfferPendingRef.current = false;
  deps.frustrationSkipAwaitingConfirmationRef.current = false;
  const skipOfferSourceBeforeClear = deps.scenarioSkipOfferSourceRef.current;
  deps.frustrationSkipHadPriorAnswerRef.current = null;
  deps.scenarioSkipOfferSourceRef.current = null;
  if (skipOfferSourceBeforeClear === 'inability_escalation') {
    deps.inabilityCountByMomentRef.current = {
      ...deps.inabilityCountByMomentRef.current,
      [momentNumDecline]: 0,
    };
  }
  const encouragement = FRUSTRATION_SKIP_DECLINE_ENCOURAGEMENT_LINE;
  const encouragementMsg: MessageWithScenario = {
    role: 'assistant',
    content: encouragement,
    scenarioNumber: tag as 1 | 2 | 3,
  };
  deps.setMessages([...messagesToUse, encouragementMsg]);
  await deps.speakTextSafe(encouragement, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    skipLastQuestionRef: true,
  });
  return finishPreClaudeSkipInjectionTurn(deps);
}
