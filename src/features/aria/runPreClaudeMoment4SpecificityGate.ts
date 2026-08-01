import { isDecline, isExplicitPassForMoment4CommitmentFollowUp } from '@features/aria/interviewControlTokens';
import { looksLikeIncompleteCutOffUserAnswer } from '@features/aria/interviewAnswerRelevance';
import { looksLikeGoBackToPreviousScenarioRequest } from '@features/aria/interviewGoBackRequest';
import { isInterviewHardStopUserTurn } from '@features/aria/interviewDisengagementProbes';
import { looksLikePriorAnswerMetaComment } from '@features/aria/interviewPriorAnswerMetaDetection';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { hasCommitmentThresholdSignal } from '@features/aria/interviewMoment5AppreciationBridge';
import {
  evaluateMoment4RelationshipType,
  looksLikeMisplacedNonGrudgeMoment4Answer,
  looksLikeMoment4GrudgePrompt,
  shouldForceMoment4ThresholdProbe as evaluateMoment4ThresholdProbeEligibility,
  transcriptIncludesMoment4ThresholdAssistant,
} from '@features/aria/moment4ProbeLogic';
import {
  MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT,
  MOMENT4_SPECIFICITY_LOW_WORD_THRESHOLD,
  evaluateMoment4SpecificityProbe,
  isAnsweringMoment4SpecificityFollowUp,
  looksLikeMoment4SpecificityFollowUpEcho,
  needsMoment4SpecificityFollowUp,
} from '@features/aria/moment4SpecificityFollowUp';
import { deliverMoment4CommitmentThresholdProbe } from '@features/aria/deliverMoment4CommitmentThresholdProbe';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { remoteLog } from '@utilities/remoteLog';

export type PreClaudeMoment4SpecificityGateResult = {
  handled: boolean;
  answeringAfterMoment4SpecificityProbe: boolean;
  shouldForceMoment4ThresholdProbe: boolean;
  moment4ThresholdHintInAnswer: boolean;
};

/**
 * Moment 4 specificity scoring, eval telemetry, commitment-follow-up condition, and client inject.
 */
export async function runPreClaudeMoment4SpecificityGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  lastAssistantContent: string,
  orchestratorOwnsThresholdInject = false,
): Promise<PreClaudeMoment4SpecificityGateResult> {
  const lastAssistantLooksLikeMoment4Grudge = looksLikeMoment4GrudgePrompt(lastAssistantContent);
  const lastQuestionLooksLikeMoment4Grudge = looksLikeMoment4GrudgePrompt(
    deps.lastQuestionTextRef.current ?? '',
  );
  /**
   * Canonical M4 grudge may have been spoken (show-card / confusion replay) while moment refs
   * lagged at 2–3 — heal before eligibility so we inject the scripted threshold instead of
   * letting the model invent a "work through or walk away" paraphrase.
   */
  if (
    deps.currentInterviewMomentRef.current < 4 &&
    (lastAssistantLooksLikeMoment4Grudge || lastQuestionLooksLikeMoment4Grudge)
  ) {
    deps.currentInterviewMomentRef.current = 4;
    deps.interviewMomentsCompleteRef.current[3] = true;
    deps.personalHandoffInjectedRef.current = true;
    void remoteLog('[M4_MOMENT_HEALED_FROM_GRUDGE_CONTEXT]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      fromLastAssistant: lastAssistantLooksLikeMoment4Grudge,
      fromLastQuestion: lastQuestionLooksLikeMoment4Grudge,
    });
  }

  const expectingPostSpecificityAnswer =
    deps.currentInterviewMomentRef.current === 4 &&
    deps.moment4ExpectingPostSpecificityUserTurnRef.current === true;

  const answeringAfterMoment4SpecificityProbe =
    deps.currentInterviewMomentRef.current === 4 &&
    (isAnsweringMoment4SpecificityFollowUp(messagesToUse, lastAssistantContent) ||
      expectingPostSpecificityAnswer);

  if (deps.currentInterviewMomentRef.current === 4 && answeringAfterMoment4SpecificityProbe) {
    if (expectingPostSpecificityAnswer) {
      deps.moment4ExpectingPostSpecificityUserTurnRef.current = false;
    }
    deps.moment4PostGrudgeSpecificityResolvedRef.current = true;
    deps.moment4SpecificityScoringRef.current = {
      clientSpecificityFollowUpAsked: true,
      lowSpecificityAfterProbe: needsMoment4SpecificityFollowUp(trimmed),
    };
  }

  const moment4AnswerLooksMisplaced = looksLikeMisplacedNonGrudgeMoment4Answer(trimmed);
  const moment4ThresholdHintInAnswer = hasCommitmentThresholdSignal(trimmed);
  const isPriorAnswerMetaTurn = looksLikePriorAnswerMetaComment(trimmed);

  if (
    deps.currentInterviewMomentRef.current === 4 &&
    looksLikeMoment4SpecificityFollowUpEcho(lastAssistantContent)
  ) {
    deps.moment4PostGrudgeSpecificityResolvedRef.current = true;
  }

  const moment4SpecificityProbeEval =
    deps.currentInterviewMomentRef.current === 4 &&
    lastAssistantLooksLikeMoment4Grudge &&
    !moment4AnswerLooksMisplaced &&
    !answeringAfterMoment4SpecificityProbe &&
    !isPriorAnswerMetaTurn
      ? evaluateMoment4SpecificityProbe(trimmed)
      : null;

  if (moment4SpecificityProbeEval) {
    const specificityEvalPayload = {
      hasNamedPerson: moment4SpecificityProbeEval.hasNamedPerson,
      hasSpecificEvent: moment4SpecificityProbeEval.hasSpecificEvent,
      genericOpenerDetected: moment4SpecificityProbeEval.genericOpenerDetected,
      wordCount: moment4SpecificityProbeEval.wordCount,
      probeFired: moment4SpecificityProbeEval.probeShouldFire,
      triggerReason: moment4SpecificityProbeEval.triggerReason,
    };
    console.log('[M4_SPECIFICITY_PROBE_EVAL]', specificityEvalPayload);
    void remoteLog('[M4_SPECIFICITY_PROBE_EVAL]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      ...specificityEvalPayload,
    });
  }

  if (
    deps.currentInterviewMomentRef.current === 4 &&
    lastAssistantLooksLikeMoment4Grudge &&
    !moment4AnswerLooksMisplaced
  ) {
    if (isDecline(trimmed) && !looksLikeIncompleteCutOffUserAnswer(trimmed)) {
      deps.moment4PostGrudgeSpecificityResolvedRef.current = true;
    } else if (moment4SpecificityProbeEval && !moment4SpecificityProbeEval.probeShouldFire) {
      if (
        moment4SpecificityProbeEval.triggerReason !== 'cutoff' &&
        !looksLikeIncompleteCutOffUserAnswer(trimmed)
      ) {
        deps.moment4PostGrudgeSpecificityResolvedRef.current = true;
      }
    }
  }

  const moment4CommitmentFollowUpBaseEligible = evaluateMoment4ThresholdProbeEligibility({
    isMoment4: deps.currentInterviewMomentRef.current === 4,
    probeAlreadyAsked: deps.moment4ThresholdProbeAskedRef.current,
    lastAssistantContent,
    userAnswerText: trimmed,
    answeringSpecificityFollowUp: answeringAfterMoment4SpecificityProbe,
  });
  const moment4UserExplicitPass = isExplicitPassForMoment4CommitmentFollowUp(trimmed);
  const moment4SpecificityProbePending =
    moment4SpecificityProbeEval?.probeShouldFire === true &&
    !moment4AnswerLooksMisplaced &&
    !looksLikeIncompleteCutOffUserAnswer(trimmed) &&
    !isDecline(trimmed) &&
    !isInterviewHardStopUserTurn(trimmed);
  if (moment4SpecificityProbePending) {
    deps.moment4PostGrudgeSpecificityResolvedRef.current = false;
  }
  const shouldForceMoment4ThresholdProbe =
    moment4CommitmentFollowUpBaseEligible &&
    !moment4UserExplicitPass &&
    deps.moment4PostGrudgeSpecificityResolvedRef.current &&
    !moment4SpecificityProbePending &&
    !looksLikeIncompleteCutOffUserAnswer(trimmed);
  const moment4ThresholdFollowUpAlreadyInSession =
    deps.moment4ThresholdProbeAskedRef.current ||
    transcriptIncludesMoment4ThresholdAssistant(messagesToUse.slice(0, -1));

  let moment4CommitmentFollowUpReasonIfFalse: string | null = null;
  if (!shouldForceMoment4ThresholdProbe) {
    if (deps.currentInterviewMomentRef.current !== 4) moment4CommitmentFollowUpReasonIfFalse = 'not_moment_4';
    else if (deps.moment4ThresholdProbeAskedRef.current) {
      moment4CommitmentFollowUpReasonIfFalse = 'commitment_follow_up_already_asked';
    } else if (moment4UserExplicitPass) moment4CommitmentFollowUpReasonIfFalse = 'explicit_pass_or_empty';
    else if (!lastAssistantLooksLikeMoment4Grudge && !answeringAfterMoment4SpecificityProbe) {
      moment4CommitmentFollowUpReasonIfFalse = 'not_replying_to_grudge_or_specificity_prompt';
    } else if (moment4AnswerLooksMisplaced) {
      moment4CommitmentFollowUpReasonIfFalse = 'misplaced_non_grudge_answer';
    } else if (moment4SpecificityProbePending) {
      moment4CommitmentFollowUpReasonIfFalse = 'specificity_probe_pending_on_current_answer';
    } else if (!deps.moment4PostGrudgeSpecificityResolvedRef.current) {
      moment4CommitmentFollowUpReasonIfFalse = 'post_grudge_specificity_unresolved';
    } else if (looksLikeIncompleteCutOffUserAnswer(trimmed)) {
      moment4CommitmentFollowUpReasonIfFalse = 'incomplete_cutoff_answer';
    }
  }

  if (deps.currentInterviewMomentRef.current === 4) {
    const relationshipEval = evaluateMoment4RelationshipType(trimmed);
    const payload = {
      moment4CommitmentFollowUpConditionMet: shouldForceMoment4ThresholdProbe,
      moment4CommitmentFollowUpBaseEligible,
      moment4CommitmentFollowUpReasonIfFalse,
      lastAssistantLooksLikeMoment4Grudge,
      moment4AnswerLooksMisplaced,
      relationshipTypeDiagnosticOnly: relationshipEval.relationshipType,
      closeSignals: relationshipEval.closeSignals,
      nonCloseSignals: relationshipEval.nonCloseSignals,
      probeAlreadyAsked: deps.moment4ThresholdProbeAskedRef.current,
      moment4UserExplicitPass,
      moment4ThresholdHintInAnswer,
      answerPreview: trimmed.slice(0, 500),
    };
    if (__DEV__) {
      console.log('[M4_COMMITMENT_FOLLOWUP_CONDITION]', payload);
    }
    void remoteLog('[M4_COMMITMENT_FOLLOWUP_CONDITION]', payload);
  }

  if (
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    deps.status === 'active' &&
    !deps.closingQuestionPending &&
    deps.waitingForClosingAdditionRef.current === null &&
    deps.currentInterviewMomentRef.current === 4 &&
    !deps.moment4ClientSpecificityProbeInjectedRef.current &&
    !moment4ThresholdFollowUpAlreadyInSession &&
    moment4SpecificityProbePending &&
    lastAssistantLooksLikeMoment4Grudge &&
    !isInterviewHardStopUserTurn(trimmed)
  ) {
    deps.moment4ClientSpecificityProbeInjectedRef.current = true;
    deps.moment4ExpectingPostSpecificityUserTurnRef.current = true;
    void remoteLog('[M4_SPECIFICITY_FOLLOWUP_INJECT]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      wordCount: moment4SpecificityProbeEval.wordCount,
      triggerReason: moment4SpecificityProbeEval.triggerReason,
      preview: trimmed.slice(0, 240),
    });
    deps.probeLogRef.current.push({
      scenario: (deps.currentScenarioRef.current ?? 3) as number,
      construct: 'commitment_threshold',
      probe_fired: true,
      trigger_reason: 'moment4_low_specificity',
      pre_probe_score: 0,
      post_probe_score: 0,
      score_delta: 0,
    });
    const scenarioNumber = ((deps.currentScenarioRef.current as 1 | 2 | 3 | undefined) ?? 3) as 1 | 2 | 3;
    const specProbeMsg: MessageWithScenario = {
      role: 'assistant',
      content: MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT,
      scenarioNumber,
    };
    deps.setMessages([...messagesToUse, specProbeMsg]);
    await deps.speakTextSafe(MOMENT_4_SPECIFICITY_FOLLOW_UP_TEXT, ASSISTANT_INTERVIEW_SPEECH);
    deps.setVoiceState('idle');
    deps.setIsWaiting(false);
    return {
      handled: true,
      answeringAfterMoment4SpecificityProbe,
      shouldForceMoment4ThresholdProbe,
      moment4ThresholdHintInAnswer,
    };
  }

  if (
    !orchestratorOwnsThresholdInject &&
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    deps.status === 'active' &&
    !deps.closingQuestionPending &&
    deps.waitingForClosingAdditionRef.current === null &&
    deps.currentInterviewMomentRef.current === 4 &&
    shouldForceMoment4ThresholdProbe &&
    !moment4ThresholdFollowUpAlreadyInSession &&
    !looksLikeIncompleteCutOffUserAnswer(trimmed) &&
    !looksLikeGoBackToPreviousScenarioRequest(trimmed)
  ) {
    const delivered = await deliverMoment4CommitmentThresholdProbe({
      deps,
      trimmed,
      messagesToUse,
      logTag: '[M4_COMMITMENT_THRESHOLD_PRE_INJECT]',
    });
    if (delivered) {
      return {
        handled: true,
        answeringAfterMoment4SpecificityProbe,
        shouldForceMoment4ThresholdProbe,
        moment4ThresholdHintInAnswer,
      };
    }
  }

  return {
    handled: false,
    answeringAfterMoment4SpecificityProbe,
    shouldForceMoment4ThresholdProbe,
    moment4ThresholdHintInAnswer,
  };
}
