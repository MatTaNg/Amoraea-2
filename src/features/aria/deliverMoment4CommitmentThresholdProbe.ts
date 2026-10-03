import { looksLikeGoBackToPreviousScenarioRequest } from '@features/aria/interviewGoBackRequest';
import { looksLikeIncompleteCutOffUserAnswer } from '@features/aria/interviewAnswerRelevance';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import {
  buildMoment4ThresholdProbeWithReflection,
  MOMENT_4_COMMITMENT_THRESHOLD_NO_RELATIONSHIP_SPOKEN,
  transcriptIncludesMoment4ThresholdAssistant,
} from '@features/aria/moment4ProbeLogic';
import {
  extractLeadingReflectionFromMoment4ThresholdProbe,
  registerDeliveredReflection,
} from '@features/aria/deliveredReflectionRegistry';
import { applyInterviewCanonicalProbeSideEffects } from '@features/aria/interviewCanonicalProbeDeliveryShared';
import { applyMoment4ThresholdReferenceCard } from '@features/aria/interviewReferenceCardResumeHelpers';
import {
  resolveMoment4GrudgeAnswerForThresholdReflection,
  userLacksRelevantCommitmentRelationship,
} from '@features/aria/moment4SpecificityFollowUp';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { remoteLog } from '@utilities/remoteLog';

/** Deliver M4 commitment-threshold probe — shared by specificity gate and orchestrator executor. */
export async function deliverMoment4CommitmentThresholdProbe(args: {
  deps: PreClaudeTurnGateDeps;
  trimmed: string;
  messagesToUse: MessageWithScenario[];
  logTag: string;
}): Promise<boolean> {
  let blockReason: string | null = null;
  if (!args.deps.isInterviewAppRoute) blockReason = 'not_interview_app_route';
  else if (args.deps.isAdmin) blockReason = 'admin';
  else if (args.deps.status !== 'active') blockReason = 'status_not_active';
  else if (args.deps.closingQuestionPending) blockReason = 'closing_question_pending';
  else if (args.deps.waitingForClosingAdditionRef.current !== null) {
    blockReason = 'waiting_for_closing_addition';
  } else if (args.deps.currentInterviewMomentRef.current !== 4) {
    blockReason = 'not_moment_4';
  } else if (transcriptIncludesMoment4ThresholdAssistant(args.messagesToUse)) {
    blockReason = 'threshold_already_in_transcript';
  } else if (
    looksLikeIncompleteCutOffUserAnswer(args.trimmed) &&
    !userLacksRelevantCommitmentRelationship(args.trimmed)
  ) {
    blockReason = 'incomplete_cutoff_answer';
  } else if (looksLikeGoBackToPreviousScenarioRequest(args.trimmed)) {
    blockReason = 'go_back_request';
  }
  if (blockReason) {
    return false;
  }

  const grudgeAnswerForReflection = resolveMoment4GrudgeAnswerForThresholdReflection(
    args.messagesToUse,
    args.trimmed,
  );
  const thresholdQuestion = buildMoment4ThresholdProbeWithReflection(grudgeAnswerForReflection, {
    deliveredRegistry: args.deps.deliveredReflectionRegistryRef.current,
    moment4Transcript: args.messagesToUse,
  });
  const thresholdProbeText = userLacksRelevantCommitmentRelationship(args.trimmed)
    ? MOMENT_4_COMMITMENT_THRESHOLD_NO_RELATIONSHIP_SPOKEN
    : thresholdQuestion;

  void remoteLog(args.logTag, {
    interviewSessionId: args.deps.interviewSessionIdRef.current,
    preview: thresholdProbeText.slice(0, 240),
  });

  if (args.deps.parallelStreamingTtsRef.current.active) {
    args.deps.parallelStreamingTtsRef.current.cancelRequested = true;
  }

  args.deps.probeLogRef.current.push({
    scenario: (args.deps.currentScenarioRef.current ?? 3) as number,
    construct: 'commitment_threshold',
    probe_fired: true,
    trigger_reason: 'orchestrator_execute_m4_threshold',
    pre_probe_score: 0,
    post_probe_score: 0,
    score_delta: 0,
  });

  const scenarioNumber = ((args.deps.currentScenarioRef.current as 1 | 2 | 3 | undefined) ?? 3) as 1 | 2 | 3;
  const thresholdMsg: MessageWithScenario = {
    role: 'assistant',
    content: thresholdProbeText,
    scenarioNumber,
  };
  args.deps.setMessages([...args.messagesToUse, thresholdMsg]);
  applyMoment4ThresholdReferenceCard(args.deps);
  await args.deps.speakTextSafe(thresholdProbeText, ASSISTANT_INTERVIEW_SPEECH);

  const deliveredReflection = extractLeadingReflectionFromMoment4ThresholdProbe(thresholdProbeText);
  if (deliveredReflection) {
    registerDeliveredReflection(
      args.deps.deliveredReflectionRegistryRef,
      'm4_grudge_to_threshold',
      deliveredReflection,
      {
        interviewSessionId: args.deps.interviewSessionIdRef.current,
        source: 'orchestrator_execute_m4_threshold',
      },
    );
  }

  applyInterviewCanonicalProbeSideEffects(args.deps, 'm4_commitment_threshold', thresholdProbeText);
  args.deps.setVoiceState('idle');
  args.deps.setIsWaiting(false);
  return true;
}
