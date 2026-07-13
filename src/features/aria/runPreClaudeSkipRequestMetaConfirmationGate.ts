import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { hadPriorSubstantiveAnswerInScenarioForFrustration } from '@features/aria/metaCommentClassification';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  finishPreClaudeSkipInjectionTurn,
  isPreClaudeTurnSkipInjectionRouteActive,
  scenarioTagForSkipMoment,
  type PreClaudeTurnSkipInjectionResult,
} from '@features/aria/preClaudeTurnSkipInjectionShared';

export async function runPreClaudeSkipRequestMetaConfirmationGate(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
  skipRequestConfirmationSpeech: string,
): Promise<PreClaudeTurnSkipInjectionResult | null> {
  if (!isPreClaudeTurnSkipInjectionRouteActive(deps)) {
    return null;
  }

  const tagSr = scenarioTagForSkipMoment(deps, messagesToUse);
  deps.scenarioSkipOfferSourceRef.current = 'skip_request_meta';
  deps.frustrationSkipOfferPendingRef.current = true;
  deps.frustrationSkipAwaitingConfirmationRef.current = true;
  deps.frustrationSkipHadPriorAnswerRef.current = hadPriorSubstantiveAnswerInScenarioForFrustration(
    messagesToUse.slice(0, -1),
    tagSr as 1 | 2 | 3,
  );
  const skipReqMsg: MessageWithScenario = {
    role: 'assistant',
    content: skipRequestConfirmationSpeech,
    scenarioNumber: tagSr as 1 | 2 | 3,
  };
  deps.setMessages([...messagesToUse, skipReqMsg]);
  await deps.speakTextSafe(skipRequestConfirmationSpeech, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    allowDuplicateConsecutiveTts: true,
  });
  return finishPreClaudeSkipInjectionTurn(deps);
}
