import { findLastRepeatableInterviewQuestionText } from '@features/aria/interviewDisengagementProbes';
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
import { resolveInterviewQuestionRepeatTtsText } from '@features/aria/scenarioARepairQuestionHelpers';
import { remoteLog } from '@utilities/remoteLog';

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
  const lastUserAnswer = [...messagesToUse].reverse().find((m) => m.role === 'user')?.content;
  const pendingQuestion = findLastRepeatableInterviewQuestionText(
    messagesToUse,
    deps.resumeLastAssistantTextRef.current ?? deps.lastQuestionTextRef.current,
    { activeScenario: deps.currentScenarioRef.current },
  );
  const replayText = pendingQuestion.trim()
    ? resolveInterviewQuestionRepeatTtsText(pendingQuestion, {
        firstName: deps.interviewNameRef.current ?? '',
        lastUserAnswer,
        activeScenario: deps.currentScenarioRef.current,
      })
    : '';
  const encouragement = FRUSTRATION_SKIP_DECLINE_ENCOURAGEMENT_LINE;
  const replay = replayText.trim();
  const transcriptLine = replay ? `${encouragement} ${replay}` : encouragement;
  const encouragementMsg: MessageWithScenario = {
    role: 'assistant',
    content: transcriptLine,
    scenarioNumber: tag as 1 | 2 | 3,
  };
  deps.setMessages([...messagesToUse, encouragementMsg]);
  if (replay) {
    deps.lastQuestionTextRef.current = replay;
    void remoteLog('[FRUSTRATION_SKIP_DECLINE_REASK]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: replay.slice(0, 220),
      skipOfferSource: skipOfferSourceBeforeClear,
    });
  }
  await deps.speakTextSafe(encouragement, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    skipLastQuestionRef: true,
    skipQuestionDeliveredTelemetry: true,
    allowDuplicateConsecutiveTts: true,
  });
  if (replay) {
    await deps.speakTextSafe(replay, {
      ...ASSISTANT_INTERVIEW_SPEECH,
      allowDuplicateConsecutiveTts: true,
      skipScenarioAContemptProbeSessionDedup: true,
    });
  }
  return finishPreClaudeSkipInjectionTurn(deps);
}
