import { sanitizeAssistantInterviewerCharacterNames } from '@/constants/interviewCharacterNames';
import { supabase } from '@data/supabase/client';
import { splitScenarioTransitionForEmotionModal } from '@features/aria/emotionRecognitionInterview';
import type { InterviewMomentIndex, InterviewProgressRefs } from '@features/aria/interviewProgressSync';
import { deliverClientOwnedMoment5InterviewComplete } from '@features/aria/deliverClientOwnedMoment5InterviewComplete';
import {
  SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE,
  SKIP_ACCEPTED_SCENARIO_COMPLETE_BRIDGE,
  buildSkipAcceptedSystemSuffix,
  resolveQuestionSkipProgression,
} from '@features/aria/interviewQuestionSkipProgression';
import { assessablePromptQuestionBody } from '@features/aria/interviewAssessablePromptText';
import { resolveScenarioUserTextForBoundaryReflection } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  computeSkipPenaltyGateComputation,
  individualPenaltyForSkipNumber,
} from '@features/aria/interviewSkipPenalties';
import {
  buildScenarioFictionHandoffBundleWithDynamicLead,
} from '@features/aria/resolveScenarioBoundaryLeadForInterview';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { commitDedupedAssistantTranscriptTurn } from '@features/aria/interviewTranscriptDedup';
import {
  dedupeAdjacentBoundaryValidationsBeforeParticipantName,
  ensureSpokenTextIncludesParticipantFirstName,
} from '@features/aria/interviewerFrameworkPrompt';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  isPreClaudeTurnSkipInjectionRouteActive,
  type PreClaudeTurnSkipInjectionResult,
} from '@features/aria/preClaudeTurnSkipInjectionShared';
import { SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY } from '@features/aria/scenarioAContemptProbeTtsStrip';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from '@features/aria/probeAndScoringUtils';
import {
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import { getScenarioNumberForNewMessage } from '@features/aria/scenarioNumberDetection';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime, markQuestionDelivered, writeSessionLog } from '@utilities/sessionLogging';

function momentCountsTowardSkipPenaltyLadder(momentNum: number): boolean {
  return (momentNum >= 1 && momentNum <= 3) || momentNum === 5;
}

function recordConfirmedInterviewSkipPenalty(
  deps: PreClaudeTurnGateDeps,
  momentNum: number,
): void {
  if (!momentCountsTowardSkipPenaltyLadder(momentNum)) return;
  deps.scenarioSkipConfirmedCountRef.current += 1;
  const skipNum = deps.scenarioSkipConfirmedCountRef.current;
  const individualPenalty = individualPenaltyForSkipNumber(skipNum as 1 | 2 | 3);
  if (individualPenalty != null) {
    deps.scenarioSkipPenaltySumRef.current += individualPenalty;
  }
  const cumulativeSkipPenalty = deps.scenarioSkipPenaltySumRef.current;
  if (deps.userId) {
    const r = getSessionLogRuntime();
    writeSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'skip_penalty_applied',
      eventData: {
        moment_number: momentNum,
        skip_number: skipNum,
        individual_penalty: individualPenalty,
        auto_fail_triggered: skipNum === 3,
        cumulative_skip_penalty: cumulativeSkipPenalty,
      },
      platform: r.platform,
    });
  }
  const attemptIdSkip = deps.interviewSessionAttemptIdRef.current;
  if (attemptIdSkip && deps.userId) {
    const gateSnap = computeSkipPenaltyGateComputation(skipNum);
    void supabase
      .from('interview_attempts')
      .update({
        skip_count: gateSnap.skips_taken,
        skip_penalties: gateSnap.skip_penalties,
        skip_penalty_total: gateSnap.skip_penalty_total,
        ...(gateSnap.skipAutoFail
          ? { auto_failed: true, auto_fail_reason: 'exceeded_skip_limit' }
          : {}),
      })
      .eq('id', attemptIdSkip)
      .eq('user_id', deps.userId);
  }
}

function markConstructProbeRefsForDeliveredPrompt(
  deps: PreClaudeTurnGateDeps,
  nextPrompt: string,
): void {
  if (nextPrompt === SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY) {
    deps.scenarioAContemptProbeAskedRef.current = true;
  }
  if (nextPrompt === SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY) {
    deps.scenarioARepairQuestionAskedRef.current = true;
  }
  if (nextPrompt === SCENARIO_B_JAMES_REPAIR_CANONICAL) {
    deps.s2RepairProbeDeliveredRef.current = true;
  }
}

async function deliverSkipAcceptedNextQuestion(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
  nextPrompt: string,
  scenarioTag: 1 | 2 | 3,
): Promise<void> {
  const questionBody = assessablePromptQuestionBody(nextPrompt);
  const spoken = `${SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE} ${questionBody}`.replace(/\s+/g, ' ').trim();
  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : messagesToUse) as MessageWithScenario[];
  commitDedupedAssistantTranscriptTurn(
    liveTranscript,
    messagesToUse,
    spoken,
    {
      scenarioNumber: scenarioTag,
      interviewMoment: deps.currentInterviewMomentRef.current,
    },
    (next) => deps.setMessages(next),
  );
  deps.lastQuestionTextRef.current = questionBody;
  markConstructProbeRefsForDeliveredPrompt(deps, questionBody);
  // Keep Show-scenario footer on the next scripted question — never S1 bleed / bridge text.
  deps.setReferenceCardPrompt?.(questionBody);
  void remoteLog('[SKIP_ACCEPTED_NEXT_QUESTION_CLIENT]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    preview: spoken.slice(0, 220),
    scenarioNumber: scenarioTag,
    nextPromptPreview: questionBody.slice(0, 120),
  });
  await deps.speakTextSafe(spoken, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    // Spoken line includes the skip bridge — do not let speech-advance rewrite the modal from it.
    skipInterviewSpeechAdvance: true,
  });
  markQuestionDelivered(new Date().toISOString());
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
}

async function deliverSkipAcceptedScenarioHandoff(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
  completedMoment: 1 | 2,
  participantFirstName: string,
): Promise<boolean> {
  const firstName =
    (deps.interviewNameRef.current ?? '').trim() || participantFirstName.trim() || '';
  const userCorpus = resolveScenarioUserTextForBoundaryReflection(messagesToUse, completedMoment);
  const lead = `${SKIP_ACCEPTED_SCENARIO_COMPLETE_BRIDGE}. `;
  const bundle = await buildScenarioFictionHandoffBundleWithDynamicLead({
    completedScenario: completedMoment,
    firstName,
    lastUserAnswer: userCorpus,
    interviewSessionId: deps.interviewSessionIdRef.current,
  });
  let fullDisplay = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
    sanitizeAssistantInterviewerCharacterNames(lead + bundle),
    firstName,
  );
  fullDisplay = ensureSpokenTextIncludesParticipantFirstName(fullDisplay, firstName, {
    allowAppendWhenMissing: true,
  });

  const nextScenario = (completedMoment + 1) as 2 | 3;
  const aiMsg: MessageWithScenario = {
    role: 'assistant',
    content: fullDisplay,
    scenarioNumber: nextScenario,
    interviewMoment: nextScenario,
  };
  const updatedMessages = [...messagesToUse, aiMsg];
  deps.setMessages(updatedMessages);
  deps.currentScenarioRef.current = nextScenario;
  deps.resumeActiveScenarioRef.current = nextScenario;

  const progressRefs: InterviewProgressRefs = {
    interviewMomentsCompleteRef: deps.interviewMomentsCompleteRef,
    currentInterviewMomentRef: deps.currentInterviewMomentRef,
    personalHandoffInjectedRef: deps.personalHandoffInjectedRef,
  };
  deps.applyInterviewProgressFromAssistantText?.(fullDisplay, progressRefs);
  deps.setHighestScenarioReached?.((prev) => Math.max(prev, completedMoment));
  if (!deps.scoredScenariosRef.current.has(completedMoment)) {
    deps.scoredScenariosRef.current.add(completedMoment);
    deps.scoreScenario?.(completedMoment, updatedMessages);
  }

  void remoteLog('[SKIP_ACCEPTED_SCENARIO_HANDOFF_CLIENT]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    completedMoment,
    nextScenario,
    preview: fullDisplay.slice(0, 220),
  });

  const split = splitScenarioTransitionForEmotionModal(fullDisplay);
  try {
    await deps.speakTextSafe(split.beforeModal, ASSISTANT_INTERVIEW_SPEECH);
  } catch {
    /* continue */
  }
  await deps.runEmotionModalAfterScenarioTransition?.(completedMoment, {
    transitionText: fullDisplay,
    priorScenario: completedMoment,
    afterBeforeModalPlayback: true,
  });
  if (split.afterModal.trim()) {
    try {
      await deps.speakTextSafe(split.afterModal, ASSISTANT_INTERVIEW_SPEECH);
    } catch {
      /* continue */
    }
  }
  await deps.notifyScenarioStarted?.(nextScenario, updatedMessages);
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  markQuestionDelivered(new Date().toISOString());
  return true;
}

async function deliverSkipAcceptedMoment5InterviewComplete(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
): Promise<PreClaudeTurnSkipInjectionResult> {
  await deliverClientOwnedMoment5InterviewComplete(deps, messagesToUse, 'm5_skip_accepted');
  return { haltTurn: true };
}

/**
 * Skip acceptance: apply penalties/state, then client-deliver the next prompt or scenario
 * (do not leave progression solely to the model).
 */
export async function runPreClaudeFrustrationSkipAcceptanceGate(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
): Promise<PreClaudeTurnSkipInjectionResult | null> {
  if (!isPreClaudeTurnSkipInjectionRouteActive(deps)) {
    return null;
  }

  const momentNum = deps.currentInterviewMomentRef.current;
  let userScenarioTag =
    (deps.currentScenarioRef.current as number | undefined) ??
    getScenarioNumberForNewMessage(messagesToUse, 'user');
  if (momentNum >= 4) {
    userScenarioTag = 3;
  }
  deps.frustrationSkipOfferPendingRef.current = false;
  deps.frustrationSkipAwaitingConfirmationRef.current = false;
  const hadPriorAnswer = deps.frustrationSkipHadPriorAnswerRef.current ?? false;
  deps.frustrationSkipHadPriorAnswerRef.current = null;
  const scenarioTag = Math.min(3, Math.max(1, userScenarioTag)) as 1 | 2 | 3;
  const skipProgression =
    momentNum >= 1 && momentNum <= 3
      ? resolveQuestionSkipProgression(messagesToUse, momentNum, scenarioTag)
      : { nextPrompt: '', scenarioMomentComplete: true };
  if (skipProgression.scenarioMomentComplete && momentNum >= 1 && momentNum <= 3) {
    deps.scenarioFrustrationSkipNullMarkersRef.current[scenarioTag] = true;
  }
  recordConfirmedInterviewSkipPenalty(deps, momentNum);
  const skipTrigger =
    deps.scenarioSkipOfferSourceRef.current === 'proactive_utterance'
      ? 'proactive_skip_request'
      : deps.scenarioSkipOfferSourceRef.current === 'skip_request_meta'
        ? 'skip_request_meta'
        : deps.scenarioSkipOfferSourceRef.current === 'inability_escalation'
          ? 'inability_escalation'
          : deps.scenarioSkipOfferSourceRef.current === 'already_answered_meta'
            ? 'already_answered_meta'
            : 'frustration_first_signal';
  deps.scenarioSkipOfferSourceRef.current = null;
  if (deps.userId) {
    const r = getSessionLogRuntime();
    writeSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'moment_skipped_by_user',
      eventData: {
        moment_number: momentNum,
        skip_trigger: skipTrigger,
        had_prior_answer: hadPriorAnswer,
      },
      platform: r.platform,
    });
  }
  void remoteLog('[moment_skipped_by_user]', {
    moment_number: momentNum,
    skip_trigger: skipTrigger,
    had_prior_answer: hadPriorAnswer,
    scenario_number: userScenarioTag,
    scenario_moment_complete: skipProgression.scenarioMomentComplete,
    next_prompt_preview: skipProgression.nextPrompt.slice(0, 120),
  });
  if (skipProgression.scenarioMomentComplete) {
    deps.interviewMomentsCompleteRef.current[momentNum] = true;
    if (momentNum < 5) {
      deps.currentInterviewMomentRef.current = (momentNum + 1) as InterviewMomentIndex;
    }
  }
  deps.skipContinuationSystemSuffixRef.current = buildSkipAcceptedSystemSuffix(
    skipProgression,
    momentNum,
  );

  // In-scenario: speak the next scripted question client-side and halt.
  if (
    !skipProgression.scenarioMomentComplete &&
    skipProgression.nextPrompt.trim() &&
    momentNum >= 1 &&
    momentNum <= 3
  ) {
    await deliverSkipAcceptedNextQuestion(
      deps,
      messagesToUse,
      skipProgression.nextPrompt.trim(),
      scenarioTag,
    );
    deps.skipContinuationSystemSuffixRef.current = '';
    return { haltTurn: true };
  }

  // Last question in S1/S2: client handoff into the next scenario vignette.
  if (
    skipProgression.scenarioMomentComplete &&
    (momentNum === 1 || momentNum === 2)
  ) {
    const participantFirstName = (deps.interviewNameRef.current ?? '').trim();
    await deliverSkipAcceptedScenarioHandoff(
      deps,
      messagesToUse,
      momentNum,
      participantFirstName,
    );
    deps.skipContinuationSystemSuffixRef.current = '';
    return { haltTurn: true };
  }

  // M5 final question skipped — close interview client-side and hand off to preparing_results.
  if (momentNum === 5) {
    return deliverSkipAcceptedMoment5InterviewComplete(deps, messagesToUse);
  }

  // S3 complete / M4: keep model continuation suffix (personal handoff / later moments).
  return { haltTurn: false };
}
