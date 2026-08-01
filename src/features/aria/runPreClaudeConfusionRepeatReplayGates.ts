import {
  findLastRepeatableInterviewQuestionText,
  looksLikeScenarioARepairQuestion,
  resolveInterviewQuestionRepeatTtsText,
} from '@features/aria/interviewDisengagementProbes';
import {
  hasMinimalAssessableScenarioContent,
  looksLikeInterviewProcessMetaComment,
  looksLikeInterviewProcessQuestionRepeatRequest,
} from '@features/aria/interviewAnswerRelevance';
import {
  isConfusionRepeatRequestText,
  isExplicitRepeatRequestPreClassification,
} from '@features/aria/metaCommentConfusionRepeat';
import { INTERVIEW_TURN_ORCHESTRATOR_PHASE2_ENABLED } from '@features/aria/interviewTurnOrchestratorConfig';
import {
  buildScenarioPlusQuestionRepeatTts,
  getScenarioVignetteBodyForRepeat,
  resolveInterviewRepeatRequestTarget,
  shouldAttachScenarioVignetteForRepeat,
  withRepeatRequestAcknowledgment,
} from '@features/aria/interviewRepeatRequestTarget';
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
  looksLikeScenarioAContemptProbeQuestion,
  moment5TranscriptHasConcreteAnchor,
} from '@features/aria/probeAndScoringUtils';
import {
  looksLikeScenarioBQ1Question,
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
} from '@features/aria/scenarioBProbeLogic';
import {
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCSophiePerspectiveQuestion,
} from '@features/aria/scenarioCPromptDetection';
import { resolveSituation1ExactModalPrompt } from '@features/aria/situation1ExactModalPrompt';
import { resolveSituation2ExactModalPrompt } from '@features/aria/situation2ExactModalPrompt';
import { resolveSituation3ExactModalPrompt } from '@features/aria/situation3ExactModalPrompt';
import { remoteLog } from '@utilities/remoteLog';

function inferScenarioNumberForRepeatReplay(
  replayText: string,
  fallbackScenario: number,
): 1 | 2 | 3 {
  if (
    looksLikeScenarioAContemptProbeQuestion(replayText) ||
    looksLikeScenarioARepairQuestion(replayText)
  ) {
    return 1;
  }
  if (
    looksLikeScenarioBQ1Question(replayText) ||
    looksLikeScenarioBJamesDifferentlyQuestion(replayText) ||
    looksLikeScenarioBRepairAsJamesQuestion(replayText)
  ) {
    return 2;
  }
  if (
    looksLikeScenarioCSophiePerspectiveQuestion(replayText) ||
    isScenarioCRepairAssistantPrompt(replayText)
  ) {
    return 3;
  }
  if (fallbackScenario === 1 || fallbackScenario === 2 || fallbackScenario === 3) {
    return fallbackScenario;
  }
  return 1;
}

export type PreClaudeConfusionRepeatReplayGatesResult = {
  handled: boolean;
};

function isConfusionRepeatRequest(meta: MetaCommentClassification | null | undefined): boolean {
  return meta?.type === 'confusion' && meta.confusion_subtype === 'repeat_request';
}

function shouldUseVerbatimConfusionReplay(
  trimmed: string,
  meta: MetaCommentClassification | null,
): boolean {
  if (!isConfusionRepeatRequest(meta)) return false;
  if (
    isExplicitRepeatRequestPreClassification(trimmed) ||
    isConfusionRepeatRequestText(trimmed)
  ) {
    return true;
  }
  const wc = trimmed.trim().split(/\s+/).filter(Boolean).length;
  if (wc > 15) return false;
  if (hasMinimalAssessableScenarioContent(trimmed) && wc > 10) return false;
  if (INTERVIEW_TURN_ORCHESTRATOR_PHASE2_ENABLED && looksLikeInterviewProcessMetaComment(trimmed)) {
    return false;
  }
  return true;
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

async function deliverVerbatimInterviewQuestionRepeatReplay(args: {
  deps: PreClaudeTurnGateDeps;
  messagesToUse: MessageWithScenario[];
  lastUserText: string;
  userScenarioTag: number;
  logTag: string;
  preclassified?: boolean;
}): Promise<boolean> {
  const { deps, messagesToUse, lastUserText, userScenarioTag, logTag, preclassified } = args;
  const repeatTarget = resolveInterviewRepeatRequestTarget(lastUserText);
  let repeatableQuestion = findLastRepeatableInterviewQuestionText(
    messagesToUse,
    deps.resumeLastAssistantTextRef.current ?? deps.lastQuestionTextRef.current,
    { activeScenario: deps.currentScenarioRef.current },
  );
  if (repeatableQuestion?.trim()) {
    deps.resumeLastAssistantTextRef.current = null;
  }
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
  const questionOnlyText = resolveInterviewQuestionRepeatTtsText(repeatableQuestion, {
    firstName: deps.interviewNameRef.current ?? '',
    lastUserAnswer: lastUserText,
    activeScenario: deps.currentScenarioRef.current,
  });
  if (questionOnlyText.length === 0) {
    return false;
  }
  const replayScenarioNumber = inferScenarioNumberForRepeatReplay(
    questionOnlyText,
    deps.currentScenarioRef.current ?? userScenarioTag,
  );
  const attachVignette = shouldAttachScenarioVignetteForRepeat({
    target: repeatTarget,
    interviewMoment: deps.currentInterviewMomentRef.current,
    scenarioNumber: replayScenarioNumber,
  });
  const replayText = attachVignette
    ? buildScenarioPlusQuestionRepeatTts(
        getScenarioVignetteBodyForRepeat(replayScenarioNumber),
        questionOnlyText,
      )
    : questionOnlyText;
  void remoteLog(
    attachVignette ? '[META_CONFUSION_REPEAT_SCENARIO_REPLAY]' : logTag,
    {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: replayText.slice(0, 220),
      questionPreview: questionOnlyText.slice(0, 120),
      repeatTarget,
      preclassified: preclassified ?? false,
    },
  );
  const replayMsg: MessageWithScenario = {
    role: 'assistant',
    content: replayText,
    scenarioNumber: replayScenarioNumber,
    interviewMoment: deps.currentInterviewMomentRef.current,
  };
  const nextMessages = [...messagesToUse, replayMsg];
  deps.currentMessagesRef.current = nextMessages as PreClaudeTurnGateDeps['messages'];
  deps.lastQuestionTextRef.current = questionOnlyText;
  if (looksLikeMoment4GrudgePrompt(questionOnlyText) && deps.currentInterviewMomentRef.current < 4) {
    deps.currentInterviewMomentRef.current = 4;
    deps.interviewMomentsCompleteRef.current[3] = true;
    deps.personalHandoffInjectedRef.current = true;
    void remoteLog('[M4_MOMENT_HEALED_FROM_CONFUSION_REPLAY]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
    });
  }
  const assistantForModal = nextMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const exactFooter =
    replayScenarioNumber === 3
      ? resolveSituation3ExactModalPrompt(assistantForModal, questionOnlyText)
      : replayScenarioNumber === 2
        ? resolveSituation2ExactModalPrompt(assistantForModal, questionOnlyText)
        : resolveSituation1ExactModalPrompt(assistantForModal, questionOnlyText);
  if (exactFooter.trim()) {
    deps.setReferenceCardPrompt(exactFooter);
    deps.lastQuestionTextRef.current = exactFooter;
  }
  deps.commitInterviewMessages(nextMessages as PreClaudeTurnGateDeps['messages']);
  deps.setMessages(nextMessages as PreClaudeTurnGateDeps['messages']);
  await deps.speakTextSafe(withRepeatRequestAcknowledgment(replayText), {
    ...ASSISTANT_INTERVIEW_SPEECH,
    allowDuplicateConsecutiveTts: true,
    skipScenarioAContemptProbeSessionDedup: true,
  });
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  return true;
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
    const nextMessages = [...messagesToUse, replayMsg];
    deps.currentMessagesRef.current = nextMessages as PreClaudeTurnGateDeps['messages'];
    deps.lastQuestionTextRef.current = replayText;
    deps.commitInterviewMessages(nextMessages as PreClaudeTurnGateDeps['messages']);
    deps.setMessages(nextMessages as PreClaudeTurnGateDeps['messages']);
    await deps.speakTextSafe(
      withRepeatRequestAcknowledgment(replayText),
      ASSISTANT_INTERVIEW_SPEECH,
    );
    deps.setVoiceState('idle');
    deps.setIsWaiting(false);
    return { handled: true };
  }

  const lastUserText = ([...messagesToUse].reverse().find((m) => m.role === 'user')?.content ?? '').trim();
  if (
    looksLikeInterviewProcessQuestionRepeatRequest(lastUserText) &&
    baseConfusionRepeatEligible(deps)
  ) {
    const delivered = await deliverVerbatimInterviewQuestionRepeatReplay({
      deps,
      messagesToUse,
      lastUserText,
      userScenarioTag,
      logTag: '[PROCESS_META_QUESTION_REPEAT_REPLAY]',
    });
    if (delivered) {
      return { handled: true };
    }
  }

  if (isConfusionRepeatRequest(metaCommentClassification) && baseConfusionRepeatEligible(deps)) {
    const lastUserAnswer = lastUserText;
    if (!shouldUseVerbatimConfusionReplay(lastUserAnswer, metaCommentClassification)) {
      void remoteLog('[META_CONFUSION_REPEAT_VERBATIM_SKIPPED_FOR_CLAUDE]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: lastUserAnswer.slice(0, 220),
      });
      return { handled: false };
    }
    const delivered = await deliverVerbatimInterviewQuestionRepeatReplay({
      deps,
      messagesToUse,
      lastUserText: lastUserAnswer.trim(),
      userScenarioTag,
      logTag: '[META_CONFUSION_REPEAT_VERBATIM_REPLAY]',
      preclassified: metaCommentClassification.confidence === 1.0,
    });
    if (delivered) {
      return { handled: true };
    }
  }

  return { handled: false };
}
