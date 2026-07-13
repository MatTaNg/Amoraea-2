import {
  findLastRepeatableInterviewQuestionText,
  resolveInterviewQuestionRepeatTtsText,
} from '@features/aria/interviewDisengagementProbes';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import {
  looksLikeMoment4GrudgePrompt,
  resolveMoment4ConfusionRepeatReplayFallback,
} from '@features/aria/moment4ProbeLogic';
import { isStandalonePersonalDisclosureAcknowledgment } from '@features/aria/personalDisclosureAckGate';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  buildMoment5ConfusionRepeatReplayAfterPriorAnswer,
  moment5TranscriptHasConcreteAnchor,
} from '@features/aria/probeAndScoringUtils';
import { remoteLog } from '@utilities/remoteLog';

export type PreClaudeConfusionRepeatReplayGatesResult = {
  handled: boolean;
};

function isConfusionRepeatRequest(meta: MetaCommentClassification | null | undefined): boolean {
  return meta?.type === 'confusion' && meta.confusion_subtype === 'repeat_request';
}

function baseConfusionRepeatEligible(deps: PreClaudeTurnGateDeps): boolean {
  return (
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    deps.status === 'active' &&
    !deps.closingQuestionPending &&
    deps.waitingForClosingAdditionRef.current === null
  );
}

/**
 * M5 short replay after prior concrete answer, plus verbatim meta confusion repeat replay.
 */
export async function runPreClaudeConfusionRepeatReplayGates(
  deps: PreClaudeTurnGateDeps,
  metaCommentClassification: MetaCommentClassification | null,
  messagesToUse: MessageWithScenario[],
  lastInterviewerContent: string,
  userScenarioTag: number,
): Promise<PreClaudeConfusionRepeatReplayGatesResult> {
  const moment5ConfusionRepeatWithPriorAnswer =
    isConfusionRepeatRequest(metaCommentClassification) &&
    deps.currentInterviewMomentRef.current === 5 &&
    baseConfusionRepeatEligible(deps) &&
    moment5TranscriptHasConcreteAnchor(messagesToUse);

  if (moment5ConfusionRepeatWithPriorAnswer) {
    const replayText = buildMoment5ConfusionRepeatReplayAfterPriorAnswer({
      lastInterviewerText: lastInterviewerContent,
    });
    void remoteLog('[M5_CONFUSION_REPEAT_SHORT_REPLAY]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: replayText.slice(0, 220),
    });
    const replayMsg: MessageWithScenario = {
      role: 'assistant',
      content: replayText,
      scenarioNumber: 3,
    };
    deps.setMessages([...messagesToUse, replayMsg]);
    await deps.speakTextSafe(replayText, ASSISTANT_INTERVIEW_SPEECH);
    deps.setVoiceState('idle');
    deps.setIsWaiting(false);
    return { handled: true };
  }

  if (isConfusionRepeatRequest(metaCommentClassification) && baseConfusionRepeatEligible(deps)) {
    const lastUserAnswer = [...messagesToUse].reverse().find((m) => m.role === 'user')?.content;
    let repeatableQuestion = findLastRepeatableInterviewQuestionText(
      messagesToUse,
      deps.lastQuestionTextRef.current,
      { activeScenario: deps.currentScenarioRef.current },
    );
    const m4ReplayFallback = resolveMoment4ConfusionRepeatReplayFallback(messagesToUse, {
      currentInterviewMoment: deps.currentInterviewMomentRef.current,
      moment4ThresholdProbeAsked: deps.moment4ThresholdProbeAskedRef.current,
    });
    if (
      m4ReplayFallback &&
      (!repeatableQuestion ||
        isStandalonePersonalDisclosureAcknowledgment(repeatableQuestion) ||
        looksLikeMoment4GrudgePrompt(repeatableQuestion))
    ) {
      repeatableQuestion = m4ReplayFallback;
    }
    const replayText = resolveInterviewQuestionRepeatTtsText(repeatableQuestion, {
      firstName: deps.interviewNameRef.current ?? '',
      lastUserAnswer,
      activeScenario: deps.currentScenarioRef.current,
    });
    if (replayText.length > 0) {
      void remoteLog('[META_CONFUSION_REPEAT_VERBATIM_REPLAY]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: replayText.slice(0, 220),
        preclassified: metaCommentClassification.confidence === 1.0,
      });
      const replayMsg: MessageWithScenario = {
        role: 'assistant',
        content: replayText,
        scenarioNumber: userScenarioTag as 1 | 2 | 3,
        interviewMoment: deps.currentInterviewMomentRef.current,
      };
      deps.setMessages([...messagesToUse, replayMsg]);
      await deps.speakTextSafe(replayText, {
        ...ASSISTANT_INTERVIEW_SPEECH,
        allowDuplicateConsecutiveTts: true,
        /**
         * Explicit "repeat what you said" must re-speak the current question even when
         * Scenario A contempt-probe session dedup already marked that line delivered.
         */
        skipScenarioAContemptProbeSessionDedup: true,
      });
      deps.setVoiceState('idle');
      deps.setIsWaiting(false);
      return { handled: true };
    }
  }

  return { handled: false };
}
