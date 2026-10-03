import { deliverInterviewCanonicalProbe } from '@features/aria/deliverInterviewCanonicalProbe';
import {
  buildCheckingInAckOnlySpeech,
  resolveCheckingInActiveQuestionText,
  resolveCheckingInAdvanceProbeBypassingTranscriptGuard,
  resolveCheckingInBriefAckForInterview,
  transcriptContainsAssessableQuestion,
} from '@features/aria/interviewCheckingInAck';
import {
  classifyPriorAnswerMetaKind,
  looksLikeInterviewStillOpenCheck,
} from '@features/aria/interviewPriorAnswerMetaDetection';
import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { userAnswerSatisfiesScenarioBJamesRepairPrompt } from '@features/aria/interviewRepairRefusalDetection';
import { commitDedupedAssistantTranscriptTurn } from '@features/aria/interviewTranscriptDedup';
import { countsAsSubstantiveInterviewQuestionDelivery, getPriorSubstantiveNonMetaUserContentInMoment } from '@features/aria/metaCommentClassification';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { resolvePendingCanonicalProbeForTurn } from '@features/aria/evaluateInterviewTurnOrchestratorDecision';
import {
  resolvePreClaudeScenarioConstructProbeFlags,
  type PreClaudeScenarioConstructProbeFlags,
} from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import { resolvePreClaudeAssistantTurnContext } from '@features/aria/resolvePreClaudeAssistantTurnContext';
import { looksLikeScenarioBRepairAsJamesQuestion } from '@features/aria/scenarioBProbeLogic';
import { isSufficiencyChallengeFrustrationUtterance } from '@features/aria/metaCommentSkipFrustration';
import { markQuestionDelivered } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';

export type PreClaudeCheckingInAckGateResult = { handled: boolean };

function buildAdvanceConstructFlags(
  deps: PreClaudeTurnGateDeps,
  priorSubstantive: string,
  messagesToUse: MessageWithScenario[],
  lastAssistantContent: string,
  lastInterviewerContent: string,
): PreClaudeScenarioConstructProbeFlags {
  return resolvePreClaudeScenarioConstructProbeFlags(
    deps,
    priorSubstantive,
    messagesToUse,
    lastAssistantContent,
    lastInterviewerContent,
    false,
  );
}

/**
 * Client-owned checking-in path when LLM/orchestrator cannot speak:
 * confirm sufficiency, optionally reflect prior substantive, then pivot or re-ask.
 */
export async function runPreClaudeCheckingInAckGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  metaCommentClassification: MetaCommentClassification | null,
  checkingInFrustrationAdjacent: boolean,
): Promise<PreClaudeCheckingInAckGateResult> {
  if (classifyPriorAnswerMetaKind(trimmed) !== 'sufficiency_check_in') {
    return { handled: false };
  }

  const effectiveCheckingInFrustrationAdjacent =
    checkingInFrustrationAdjacent || isSufficiencyChallengeFrustrationUtterance(trimmed);
  const effectiveMetaClassification: MetaCommentClassification =
    metaCommentClassification?.type === 'checking_in'
      ? metaCommentClassification
      : {
          type: 'checking_in',
          confidence: metaCommentClassification?.confidence ?? 0.67,
        };

  const moment = deps.currentInterviewMomentRef.current ?? 0;
  const scenario = (deps.currentScenarioRef.current ?? 1) as 1 | 2 | 3;
  const scenarioTag = moment >= 4 ? (3 as const) : scenario;
  const priorSubstantive =
    getPriorSubstantiveNonMetaUserContentInMoment(
      messagesToUse.length > 0 ? messagesToUse : deps.messages,
      scenarioTag,
      moment,
    ) ?? '';

  const { lastAssistantContent, lastInterviewerContent } = resolvePreClaudeAssistantTurnContext(
    deps,
    trimmed,
    messagesToUse,
  );
  const activeQuestionPreview = resolveCheckingInActiveQuestionText({
    messages: messagesToUse,
    lastQuestionTextRef: deps.lastQuestionTextRef.current ?? '',
    lastInterviewerContent,
    activeScenario: scenario,
  });

  const { ack } = await resolveCheckingInBriefAckForInterview({
    messages: messagesToUse,
    priorSubstantiveText: priorSubstantive,
    activeQuestionPreview,
    interviewSessionId: deps.interviewSessionIdRef.current,
    checkingInFrustrationAdjacent: effectiveCheckingInFrustrationAdjacent,
  });

  const advanceFlags = priorSubstantive
    ? buildAdvanceConstructFlags(
        deps,
        priorSubstantive,
        messagesToUse,
        lastAssistantContent,
        lastInterviewerContent,
      )
    : null;

  if (looksLikeInterviewStillOpenCheck(trimmed)) {
    const reaskOpen = activeQuestionPreview.trim();
    if (reaskOpen) {
      const spoken = `Not yet. ${reaskOpen}`;
      const liveTranscript = (deps.currentMessagesRef.current.length > 0
        ? deps.currentMessagesRef.current
        : messagesToUse) as MessageWithScenario[];
      commitDedupedAssistantTranscriptTurn(
        liveTranscript,
        messagesToUse,
        spoken,
        {
          scenarioNumber: scenarioTag,
          interviewMoment: moment,
        },
        (next) => deps.setMessages(next),
      );
      deps.lastQuestionTextRef.current = reaskOpen;
      void remoteLog('[CHECKING_IN_STILL_OPEN_REASK]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: spoken.slice(0, 220),
      });
      await deps.speakTextSafe(spoken, {
        ...ASSISTANT_INTERVIEW_SPEECH,
        skipLastQuestionRef: true,
      });
      markQuestionDelivered(new Date().toISOString());
      deps.setVoiceState('idle');
      deps.setIsWaiting(false);
      return { handled: true };
    }
  }

  const pendingAdvanceProbe: InterviewCanonicalProbeId | null = advanceFlags
    ? resolvePendingCanonicalProbeForTurn({
        snapshot: {
          userText: priorSubstantive,
          lastAssistantContent,
          lastQuestionText: deps.lastQuestionTextRef.current ?? '',
          currentInterviewMoment: moment,
          currentScenario: scenario,
          transcriptTurnCount: messagesToUse.length,
        },
        messages: messagesToUse,
        constructFlags: advanceFlags,
        lastAssistantContent,
      }) ??
      (effectiveCheckingInFrustrationAdjacent
        ? resolveCheckingInAdvanceProbeBypassingTranscriptGuard(advanceFlags, messagesToUse)
        : null)
    : null;

  if (pendingAdvanceProbe) {
    await deliverInterviewCanonicalProbe({
      deps,
      messagesToUse,
      probeId: pendingAdvanceProbe,
      userText: trimmed,
      ackPrefix: ack,
      priorSubstantiveText: priorSubstantive,
      checkingInFrustrationAdjacent: effectiveCheckingInFrustrationAdjacent,
      logTag: '[CHECKING_IN_ADVANCE_CLIENT_OWNED]',
    });
    void remoteLog('[CHECKING_IN_ADVANCE_CLIENT_OWNED]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      probeId: pendingAdvanceProbe,
      preview: ack.slice(0, 120),
      checkingInFrustrationAdjacent: effectiveCheckingInFrustrationAdjacent,
    });
    return { handled: true };
  }

  const reask = activeQuestionPreview.trim();
  if (!reask) {
    return { handled: false };
  }

  const priorAnswerSatisfiesActiveQuestion =
    !!priorSubstantive &&
    looksLikeScenarioBRepairAsJamesQuestion(reask) &&
    userAnswerSatisfiesScenarioBJamesRepairPrompt(priorSubstantive, lastAssistantContent);

  const ackOnly =
    transcriptContainsAssessableQuestion(messagesToUse, reask) ||
    !countsAsSubstantiveInterviewQuestionDelivery(reask);

  if (priorAnswerSatisfiesActiveQuestion && pendingAdvanceProbe) {
    await deliverInterviewCanonicalProbe({
      deps,
      messagesToUse,
      probeId: pendingAdvanceProbe,
      userText: trimmed,
      ackPrefix: buildCheckingInAckOnlySpeech({
        messages: messagesToUse,
        priorSubstantiveText: priorSubstantive,
        activeQuestionPreview: reask,
        priorAnswerSatisfiesActiveQuestion: true,
        checkingInFrustrationAdjacent: effectiveCheckingInFrustrationAdjacent,
      }),
      priorSubstantiveText: priorSubstantive,
      checkingInFrustrationAdjacent: effectiveCheckingInFrustrationAdjacent,
      logTag: '[CHECKING_IN_SATISFIED_ADVANCE_CLIENT_OWNED]',
    });
    return { handled: true };
  }

  if (ackOnly) {
    const spoken = buildCheckingInAckOnlySpeech({
      messages: messagesToUse,
      priorSubstantiveText: priorSubstantive,
      activeQuestionPreview: reask,
      priorAnswerSatisfiesActiveQuestion,
      checkingInFrustrationAdjacent: effectiveCheckingInFrustrationAdjacent,
    });
    if (!spoken.trim()) {
      return { handled: false };
    }

    deps.metaClassificationForPendingAssistantRef.current = effectiveMetaClassification;

    const liveTranscript = (deps.currentMessagesRef.current.length > 0
      ? deps.currentMessagesRef.current
      : messagesToUse) as MessageWithScenario[];

    commitDedupedAssistantTranscriptTurn(
      liveTranscript,
      messagesToUse,
      spoken,
      {
        scenarioNumber: scenarioTag,
        interviewMoment: moment,
      },
      (next) => deps.setMessages(next),
    );

    void remoteLog('[CHECKING_IN_ACK_ONLY_CLIENT_OWNED]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: spoken.slice(0, 220),
      checkingInFrustrationAdjacent: effectiveCheckingInFrustrationAdjacent,
      reaskPreview: reask.slice(0, 120),
    });

    await deps.speakTextSafe(spoken, {
      ...ASSISTANT_INTERVIEW_SPEECH,
      skipLastQuestionRef: true,
      skipQuestionDeliveredTelemetry: true,
      allowDuplicateConsecutiveTts: true,
    });
    deps.finalizePendingMetaAckBaselineAfterAssistantTextRef.current(spoken);
    deps.setVoiceState('idle');
    deps.setIsWaiting(false);
    return { handled: true };
  }

  const spoken = `${ack} ${reask}`.trim();
  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : messagesToUse) as MessageWithScenario[];

  commitDedupedAssistantTranscriptTurn(
    liveTranscript,
    messagesToUse,
    spoken,
    {
      scenarioNumber: scenarioTag,
      interviewMoment: moment,
    },
    (next) => deps.setMessages(next),
  );
  deps.lastQuestionTextRef.current = reask;

  void remoteLog('[CHECKING_IN_REASK_CLIENT_OWNED]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    preview: spoken.slice(0, 220),
    checking_in_frustration_adjacent: effectiveCheckingInFrustrationAdjacent,
  });

  await deps.speakTextSafe(spoken, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    skipLastQuestionRef: true,
  });
  markQuestionDelivered(new Date().toISOString());
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  return { handled: true };
}
