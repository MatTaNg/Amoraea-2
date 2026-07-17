import { SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE } from '@features/aria/interviewPromptInstructions';
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
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';

export async function runPreClaudeProactiveScenarioSkipConfirmationGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
): Promise<PreClaudeTurnSkipInjectionResult | null> {
  if (!isPreClaudeTurnSkipInjectionRouteActive(deps)) {
    return null;
  }

  const tagPro = scenarioTagForSkipMoment(deps, messagesToUse);
  const momentPro = deps.currentInterviewMomentRef.current;
  deps.scenarioSkipOfferSourceRef.current = 'proactive_utterance';
  deps.frustrationSkipOfferPendingRef.current = true;
  deps.frustrationSkipAwaitingConfirmationRef.current = true;
  deps.frustrationSkipHadPriorAnswerRef.current = hadPriorSubstantiveAnswerInScenarioForFrustration(
    messagesToUse.slice(0, -1),
    tagPro as 1 | 2 | 3,
  );
  const proactiveMsg: MessageWithScenario = {
    role: 'assistant',
    content: SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE,
    scenarioNumber: tagPro as 1 | 2 | 3,
  };
  deps.setMessages([...messagesToUse, proactiveMsg]);
  if (deps.userId) {
    const r = getSessionLogRuntime();
    writeSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'proactive_skip_confirmation_prompted',
      eventData: {
        moment_number: momentPro,
        scenario_number: tagPro,
        transcript_preview: trimmed.slice(0, 200),
      },
      platform: r.platform,
    });
  }
  await deps.speakTextSafe(SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    allowDuplicateConsecutiveTts: true,
    skipLastQuestionRef: true,
  });
  return finishPreClaudeSkipInjectionTurn(deps);
}
