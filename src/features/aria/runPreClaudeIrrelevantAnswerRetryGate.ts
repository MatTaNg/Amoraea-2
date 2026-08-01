import {
  hasQuestionRecoveryPromptAlreadySpokenForSeq,
  IRRELEVANT_ANSWER_RETRY_LINE,
  isIrrelevantAnswerRetryAssistantLine,
  looksLikeCompleteShortUserReply,
  looksLikeInterviewProcessQuestionRepeatRequest,
  looksLikeUnassessableScenarioAnswer,
} from '@features/aria/interviewAnswerRelevance';
import { looksLikePriorAnswerMetaComment } from '@features/aria/interviewPriorAnswerMetaDetection';
import { looksLikeInterviewScoreStatusRequest } from '@features/aria/interviewScoreStatusRequest';
import { isInterviewHardStopUserTurn } from '@features/aria/interviewMentalizingAndAnswerSignals';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { commitDedupedAssistantTranscriptTurn } from '@features/aria/interviewTranscriptDedup';
import { restoreReferenceCardPromptFromAssessableQuestion } from '@features/aria/runReferenceCardFromAssistantSpeech';
import {
  looksLikeFrustrationSkipConfirmationAffirmative,
  looksLikeSkipConfirmationAssistantPrompt,
} from '@features/aria/metaCommentSkipFrustration';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { shouldBypassLegacyMetaInjectForClaude } from '@features/aria/shouldBypassLegacyMetaInjectForClaude';
import { resolveHybridCutOffForInterviewTurn } from '@features/aria/resolveHybridCutOffForInterviewTurn';
import {
  isScenarioAQ1Prompt,
  looksLikeScenarioAContemptProbeAssessableShortAnswer,
} from '@features/aria/scenarioAContemptProbeCoverage';
import { looksLikeScenarioAContemptProbeQuestion } from '@features/aria/scenarioAContemptProbeLogic';
import { looksLikeScenarioARepairQuestion } from '@features/aria/scenarioARepairQuestionHelpers';
import {
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBQ1Question,
  looksLikeScenarioBRepairAsJamesQuestion,
} from '@features/aria/scenarioBProbeLogic';
import {
  looksLikeScenarioCSophiePerspectiveAssessableShortAnswer,
  looksLikeScenarioCSophiePerspectiveQuestion,
} from '@features/aria/scenarioCPromptDetection';
import {
  looksLikeMoment4ThresholdQuestion,
  looksLikeUnassessableMoment4ThresholdAnswer,
} from '@features/aria/moment4ProbeLogic';
import { remoteLog } from '@utilities/remoteLog';
import { markQuestionDelivered } from '@utilities/sessionLogging';
import { shouldDeferGatesForDedicatedMetaHandling } from '@features/aria/metaCommentDedicatedPostCommitDeferral';

function shouldDeferIrrelevantAnswerRetryForDedicatedMetaHandling(
  metaCommentClassification: MetaCommentClassification | null,
  trimmed: string,
): boolean {
  return shouldDeferGatesForDedicatedMetaHandling(metaCommentClassification, trimmed);
}

function lastAssistantLooksLikeAssessableInterviewPrompt(lastAssistantContent: string): boolean {
  const t = (lastAssistantContent ?? '').trim();
  if (!t) return false;
  // Skip confirmation is not an assessable content question — "yes" must advance, not retry.
  if (looksLikeSkipConfirmationAssistantPrompt(t)) return false;
  // Retry / cut-off line is not the interview question (keep assessing via lastQuestionTextRef).
  if (isIrrelevantAnswerRetryAssistantLine(t)) return false;
  if (isScenarioAQ1Prompt(t)) return true;
  if (looksLikeScenarioAContemptProbeQuestion(t)) return true;
  if (looksLikeScenarioARepairQuestion(t)) return true;
  if (looksLikeScenarioBQ1Question(t)) return true;
  if (looksLikeScenarioBJamesDifferentlyQuestion(t)) return true;
  if (looksLikeScenarioBRepairAsJamesQuestion(t)) return true;
  if (looksLikeScenarioCSophiePerspectiveQuestion(t)) return true;
  // Moment / other scenario questions: substantive interviewer ask ending in ?
  if (/\?\s*$/.test(t) && t.length >= 24) return true;
  return false;
}

/**
 * When the user reply cannot be scored against the current question, do not advance —
 * say so plainly (no acknowledgment, no re-asking the question).
 */
export async function runPreClaudeIrrelevantAnswerRetryGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  lastAssistantContent: string,
  metaCommentClassification: MetaCommentClassification | null = null,
): Promise<{ handled: boolean }> {
  if (!trimmed || isInterviewHardStopUserTurn(trimmed)) {
    return { handled: false };
  }
  if (looksLikeInterviewProcessQuestionRepeatRequest(trimmed)) {
    return { handled: false };
  }
  const telemetry = deps.lastUserTurnMicStopTelemetryRef?.current ?? null;
  const questionPreviewForCutOff =
    (deps.lastQuestionTextRef.current ?? '').trim() || (lastAssistantContent ?? '').trim();
  const cutOffDetection = await resolveHybridCutOffForInterviewTurn({
    transcriptText: trimmed,
    activeQuestionPreview: questionPreviewForCutOff,
    telemetry,
    interviewSessionId: deps.interviewSessionIdRef.current,
  });
  if (
    shouldBypassLegacyMetaInjectForClaude(trimmed, metaCommentClassification, telemetry) &&
    !cutOffDetection.isCutOff
  ) {
    return { handled: false };
  }
  if (looksLikeInterviewScoreStatusRequest(trimmed)) {
    return { handled: false };
  }
  if (shouldDeferIrrelevantAnswerRetryForDedicatedMetaHandling(metaCommentClassification, trimmed)) {
    return { handled: false };
  }
  // Skip acceptance already queued the next beat for the model / client delivery.
  if ((deps.skipContinuationSystemSuffixRef?.current ?? '').trim()) {
    return { handled: false };
  }
  if (looksLikeFrustrationSkipConfirmationAffirmative(trimmed)) {
    return { handled: false };
  }
  if (
    looksLikeSkipConfirmationAssistantPrompt(lastAssistantContent) ||
    looksLikeSkipConfirmationAssistantPrompt((deps.lastQuestionTextRef.current ?? '').trim())
  ) {
    return { handled: false };
  }
  const questionToKeep =
    (deps.lastQuestionTextRef.current ?? '').trim() || lastAssistantContent.trim();
  const assessablePrompt =
    lastAssistantLooksLikeAssessableInterviewPrompt(lastAssistantContent) ||
    lastAssistantLooksLikeAssessableInterviewPrompt(questionToKeep);
  // After a long pause / resume welcome-back, last assistant may not look like a question
  // even though the live beat is still a scenario or personal moment.
  const moment = deps.currentInterviewMomentRef.current ?? 0;
  const scenario = deps.currentScenarioRef.current ?? 0;
  const onInterviewContentBeat =
    (moment >= 1 && moment <= 3 && scenario >= 1) || moment >= 4;
  if (!assessablePrompt && !onInterviewContentBeat) {
    return { handled: false };
  }
  const contemptProbeQuestion =
    looksLikeScenarioAContemptProbeQuestion(questionToKeep) ||
    looksLikeScenarioAContemptProbeQuestion(lastAssistantContent);
  if (contemptProbeQuestion && looksLikeScenarioAContemptProbeAssessableShortAnswer(trimmed)) {
    return { handled: false };
  }
  const sophiePerspectiveQuestion =
    looksLikeScenarioCSophiePerspectiveQuestion(questionToKeep) ||
    looksLikeScenarioCSophiePerspectiveQuestion(lastAssistantContent);
  if (sophiePerspectiveQuestion && looksLikeScenarioCSophiePerspectiveAssessableShortAnswer(trimmed)) {
    return { handled: false };
  }
  if (
    hasQuestionRecoveryPromptAlreadySpokenForSeq(
      deps.recoveryAssistantSpokenAtSubstantiveSeqRef?.current,
      deps.substantiveInterviewQuestionDeliveredSeqRef?.current ?? 0,
    ) &&
    looksLikeCompleteShortUserReply(trimmed)
  ) {
    return { handled: false };
  }
  const thresholdQuestion =
    looksLikeMoment4ThresholdQuestion(questionToKeep) ||
    looksLikeMoment4ThresholdQuestion(lastAssistantContent);
  if (thresholdQuestion) {
    if (!looksLikeUnassessableMoment4ThresholdAnswer(trimmed) && !cutOffDetection.isCutOff) {
      return { handled: false };
    }
  } else if (!looksLikeUnassessableScenarioAnswer(trimmed) && !cutOffDetection.isCutOff) {
    return { handled: false };
  }

  if (looksLikePriorAnswerMetaComment(trimmed)) {
    return { handled: false };
  }

  const spoken = IRRELEVANT_ANSWER_RETRY_LINE;
  const scenarioNumber = (deps.currentScenarioRef.current ?? null) as 1 | 2 | 3 | null;

  void remoteLog('[IRRELEVANT_ANSWER_RETRY]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    preview: trimmed.slice(0, 80),
    questionPreview: questionToKeep.slice(0, 80),
    scenarioNumber,
    cutOffSource: cutOffDetection.source,
  });

  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : messagesToUse) as MessageWithScenario[];
  commitDedupedAssistantTranscriptTurn(
    liveTranscript,
    messagesToUse,
    spoken,
    {
      scenarioNumber: scenarioNumber ?? undefined,
      interviewMoment: deps.currentInterviewMomentRef.current,
    },
    (next) => deps.setMessages(next),
  );
  // Keep lastQuestion on the assessable question (not the retry line).
  deps.lastQuestionTextRef.current = questionToKeep;
  restoreReferenceCardPromptFromAssessableQuestion(deps, questionToKeep);
  await deps.speakTextSafe(spoken, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    skipLastQuestionRef: true,
    skipInterviewSpeechAdvance: true,
    // Same line can fire repeatedly for repeated off-topic asks — still speak it.
    allowDuplicateConsecutiveTts: true,
  });
  if (deps.recoveryAssistantSpokenAtSubstantiveSeqRef) {
    deps.recoveryAssistantSpokenAtSubstantiveSeqRef.current =
      deps.substantiveInterviewQuestionDeliveredSeqRef?.current ?? 0;
  }
  markQuestionDelivered(new Date().toISOString());
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);

  return { handled: true };
}
