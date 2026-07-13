import { isDecline, isExplicitPassForMoment4CommitmentFollowUp } from '@features/aria/interviewControlTokens';
import { isInterviewHardStopUserTurn } from '@features/aria/interviewDisengagementProbes';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { hasCommitmentThresholdSignal } from '@features/aria/interviewMoment5AppreciationBridge';
import {
  evaluateMoment4RelationshipType,
  buildMoment4ThresholdProbeWithReflection,
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
  looksLikeMoment4SpecificityFollowUpPrompt,
  needsMoment4SpecificityFollowUp,
  resolveMoment4GrudgeAnswerForThresholdReflection,
} from '@features/aria/moment4SpecificityFollowUp';
import {
  extractLeadingReflectionFromMoment4ThresholdProbe,
  registerDeliveredReflection,
} from '@features/aria/deliveredReflectionRegistry';
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
): Promise<PreClaudeMoment4SpecificityGateResult> {
  const answeringAfterMoment4SpecificityProbe =
    deps.currentInterviewMomentRef.current === 4 &&
    isAnsweringMoment4SpecificityFollowUp(messagesToUse, lastAssistantContent);

  if (deps.currentInterviewMomentRef.current === 4 && answeringAfterMoment4SpecificityProbe) {
    if (deps.moment4ExpectingPostSpecificityUserTurnRef.current) {
      deps.moment4ExpectingPostSpecificityUserTurnRef.current = false;
    }
    deps.moment4SpecificityScoringRef.current = {
      clientSpecificityFollowUpAsked: true,
      lowSpecificityAfterProbe: needsMoment4SpecificityFollowUp(trimmed),
    };
  }

  const lastAssistantLooksLikeMoment4Grudge = looksLikeMoment4GrudgePrompt(lastAssistantContent);
  const moment4AnswerLooksMisplaced = looksLikeMisplacedNonGrudgeMoment4Answer(trimmed);
  const moment4ThresholdHintInAnswer = hasCommitmentThresholdSignal(trimmed);

  if (deps.currentInterviewMomentRef.current === 4 && looksLikeMoment4SpecificityFollowUpPrompt(lastAssistantContent)) {
    deps.moment4PostGrudgeSpecificityResolvedRef.current = true;
  }

  const moment4SpecificityProbeEval =
    deps.currentInterviewMomentRef.current === 4 &&
    lastAssistantLooksLikeMoment4Grudge &&
    !moment4AnswerLooksMisplaced &&
    !answeringAfterMoment4SpecificityProbe
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
    if (isDecline(trimmed)) {
      deps.moment4PostGrudgeSpecificityResolvedRef.current = true;
    } else if (moment4SpecificityProbeEval && !moment4SpecificityProbeEval.probeShouldFire) {
      if (
        moment4SpecificityProbeEval.hasNamedPerson &&
        (moment4SpecificityProbeEval.hasSpecificEvent ||
          moment4SpecificityProbeEval.wordCount >= MOMENT4_SPECIFICITY_LOW_WORD_THRESHOLD)
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
  const shouldForceMoment4ThresholdProbe =
    moment4CommitmentFollowUpBaseEligible &&
    !moment4UserExplicitPass &&
    deps.moment4PostGrudgeSpecificityResolvedRef.current;
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
    } else if (!deps.moment4PostGrudgeSpecificityResolvedRef.current) {
      moment4CommitmentFollowUpReasonIfFalse = 'post_grudge_specificity_unresolved';
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
    !shouldForceMoment4ThresholdProbe &&
    lastAssistantLooksLikeMoment4Grudge &&
    !moment4AnswerLooksMisplaced &&
    !isDecline(trimmed) &&
    !isInterviewHardStopUserTurn(trimmed) &&
    moment4SpecificityProbeEval?.probeShouldFire === true
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
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    deps.status === 'active' &&
    !deps.closingQuestionPending &&
    deps.waitingForClosingAdditionRef.current === null &&
    deps.currentInterviewMomentRef.current === 4 &&
    shouldForceMoment4ThresholdProbe &&
    !moment4ThresholdFollowUpAlreadyInSession
  ) {
    const grudgeAnswerForReflection = resolveMoment4GrudgeAnswerForThresholdReflection(
      messagesToUse,
      trimmed,
    );
    const thresholdProbeText = buildMoment4ThresholdProbeWithReflection(grudgeAnswerForReflection, {
      deliveredRegistry: deps.deliveredReflectionRegistryRef.current,
      moment4Transcript: messagesToUse,
    });
    void remoteLog('[M4_COMMITMENT_THRESHOLD_PRE_INJECT]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: thresholdProbeText.slice(0, 240),
    });
    deps.probeLogRef.current.push({
      scenario: (deps.currentScenarioRef.current ?? 3) as number,
      construct: 'commitment_threshold',
      probe_fired: true,
      trigger_reason: 'moment4_commitment_threshold_forced',
      pre_probe_score: 0,
      post_probe_score: 0,
      score_delta: 0,
    });
    const scenarioNumber = ((deps.currentScenarioRef.current as 1 | 2 | 3 | undefined) ?? 3) as 1 | 2 | 3;
    const thresholdMsg: MessageWithScenario = {
      role: 'assistant',
      content: thresholdProbeText,
      scenarioNumber,
    };
    deps.setMessages([...messagesToUse, thresholdMsg]);
    await deps.speakTextSafe(thresholdProbeText, ASSISTANT_INTERVIEW_SPEECH);
    const deliveredReflection = extractLeadingReflectionFromMoment4ThresholdProbe(thresholdProbeText);
    if (deliveredReflection) {
      registerDeliveredReflection(
        deps.deliveredReflectionRegistryRef,
        'm4_grudge_to_threshold',
        deliveredReflection,
        {
          interviewSessionId: deps.interviewSessionIdRef.current,
          source: 'pre_claude_m4_threshold_inject',
        },
      );
    }
    deps.moment4ThresholdProbeAskedRef.current = true;
    deps.setVoiceState('idle');
    deps.setIsWaiting(false);
    return {
      handled: true,
      answeringAfterMoment4SpecificityProbe,
      shouldForceMoment4ThresholdProbe,
      moment4ThresholdHintInAnswer,
    };
  }

  return {
    handled: false,
    answeringAfterMoment4SpecificityProbe,
    shouldForceMoment4ThresholdProbe,
    moment4ThresholdHintInAnswer,
  };
}
