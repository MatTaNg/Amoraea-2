import {
  clearConfusionRepeatOfferPending,
  CONFUSION_REPEAT_OFFER_DECLINE_ACK_LINE,
  CONFUSION_REPEAT_OFFER_LINE,
  isConfusionRepeatOfferPending,
  looksLikeConfusionRepeatOfferAssent,
  looksLikeConfusionRepeatOfferDecline,
  setConfusionRepeatOfferPending,
} from '@features/aria/confusionRepeatOfferState';
import {
  findLastRepeatableInterviewQuestionText,
  resolveInterviewQuestionRepeatTtsText,
} from '@features/aria/interviewDisengagementProbes';
import { withRepeatRequestAcknowledgment } from '@features/aria/interviewRepeatRequestTarget';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { shouldBypassConfusionRepeatOfferForClaude } from '@features/aria/shouldBypassLegacyMetaInjectForClaude';
import {
  finishPreClaudeSkipInjectionTurn,
  isPreClaudeTurnSkipInjectionRouteActive,
  scenarioTagForSkipMoment,
} from '@features/aria/preClaudeTurnSkipInjectionShared';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';

export type PreClaudeConfusionOfferRepeatGateResult = {
  handled: boolean;
};

function baseEligible(deps: PreClaudeTurnGateDeps): boolean {
  return (
    isPreClaudeTurnSkipInjectionRouteActive(deps) &&
    !deps.closingQuestionPending &&
    deps.waitingForClosingAdditionRef.current === null
  );
}

async function speakAndHalt(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
  line: string,
  opts?: { skipLastQuestionRef?: boolean; isQuestionReplay?: boolean },
): Promise<PreClaudeConfusionOfferRepeatGateResult> {
  const tag = scenarioTagForSkipMoment(deps, messagesToUse);
  const msg: MessageWithScenario = {
    role: 'assistant',
    content: line,
    scenarioNumber: tag as 1 | 2 | 3,
    interviewMoment: deps.currentInterviewMomentRef.current,
  };
  const nextMessages = [...messagesToUse, msg];
  deps.currentMessagesRef.current = nextMessages as PreClaudeTurnGateDeps['messages'];
  deps.setMessages(nextMessages);
  deps.commitInterviewMessages(nextMessages as PreClaudeTurnGateDeps['messages']);
  await deps.speakTextSafe(line, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    allowDuplicateConsecutiveTts: true,
    skipLastQuestionRef: opts?.skipLastQuestionRef ?? true,
    ...(opts?.isQuestionReplay
      ? { skipScenarioAContemptProbeSessionDedup: true }
      : {}),
  });
  finishPreClaudeSkipInjectionTurn(deps);
  return { handled: true };
}

async function replayCurrentQuestion(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
): Promise<PreClaudeConfusionOfferRepeatGateResult> {
  const lastUserAnswer = [...messagesToUse].reverse().find((m) => m.role === 'user')?.content;
  const repeatableQuestion = findLastRepeatableInterviewQuestionText(
    messagesToUse,
    deps.resumeLastAssistantTextRef.current ?? deps.lastQuestionTextRef.current,
    { activeScenario: deps.currentScenarioRef.current },
  );
  const replayText = resolveInterviewQuestionRepeatTtsText(repeatableQuestion, {
    firstName: deps.interviewNameRef.current ?? '',
    lastUserAnswer,
    activeScenario: deps.currentScenarioRef.current,
  });
  if (!replayText.trim()) {
    return { handled: false };
  }
  void remoteLog('[META_CONFUSION_OFFER_ASSENT_REPLAY]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    preview: replayText.slice(0, 220),
  });
  deps.lastQuestionTextRef.current = replayText;
  return speakAndHalt(deps, messagesToUse, withRepeatRequestAcknowledgment(replayText), {
    skipLastQuestionRef: false,
    isQuestionReplay: true,
  });
}

/**
 * Content-confusion: offer to re-read the active question; on assent, replay verbatim.
 */
export async function runPreClaudeConfusionOfferRepeatGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  metaCommentClassification: MetaCommentClassification | null,
): Promise<PreClaudeConfusionOfferRepeatGateResult> {
  if (!baseEligible(deps)) {
    return { handled: false };
  }

  const sessionId = deps.interviewSessionIdRef.current;
  if (isConfusionRepeatOfferPending(sessionId)) {
    if (looksLikeConfusionRepeatOfferAssent(trimmed)) {
      clearConfusionRepeatOfferPending();
      if (deps.userId) {
        const r = getSessionLogRuntime();
        writeSessionLog({
          userId: deps.userId,
          attemptId: r.attemptId,
          eventType: 'confusion_repeat_offer_accepted',
          eventData: {
            moment_number: deps.currentInterviewMomentRef.current,
            transcript_preview: trimmed.slice(0, 200),
          },
          platform: r.platform,
        });
      }
      return replayCurrentQuestion(deps, messagesToUse);
    }
    if (looksLikeConfusionRepeatOfferDecline(trimmed)) {
      clearConfusionRepeatOfferPending();
      return speakAndHalt(deps, messagesToUse, CONFUSION_REPEAT_OFFER_DECLINE_ACK_LINE);
    }
    // Substantive / other reply — clear offer and let normal turn processing continue.
    clearConfusionRepeatOfferPending();
    return { handled: false };
  }

  const isContentConfusion =
    metaCommentClassification?.type === 'confusion' &&
    metaCommentClassification.confusion_subtype !== 'repeat_request';
  if (!isContentConfusion) {
    return { handled: false };
  }

  if (shouldBypassConfusionRepeatOfferForClaude(metaCommentClassification)) {
    return { handled: false };
  }

  setConfusionRepeatOfferPending(sessionId);
  void remoteLog('[META_CONFUSION_REPEAT_OFFER]', {
    interviewSessionId: sessionId,
    preview: CONFUSION_REPEAT_OFFER_LINE,
  });
  if (deps.userId) {
    const r = getSessionLogRuntime();
    writeSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'confusion_repeat_offer',
      eventData: {
        moment_number: deps.currentInterviewMomentRef.current,
        transcript_preview: trimmed.slice(0, 200),
        aira_response_delivered: CONFUSION_REPEAT_OFFER_LINE,
      },
      platform: r.platform,
    });
  }
  return speakAndHalt(deps, messagesToUse, CONFUSION_REPEAT_OFFER_LINE);
}
