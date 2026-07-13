import { supabase } from '@data/supabase/client';
import type { InterviewMomentIndex } from '@features/aria/interviewProgressSync';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  computeSkipPenaltyGateComputation,
  individualPenaltyForSkipNumber,
} from '@features/aria/interviewSkipPenalties';
import {
  isPreClaudeTurnSkipInjectionRouteActive,
  type PreClaudeTurnSkipInjectionResult,
} from '@features/aria/preClaudeTurnSkipInjectionShared';
import {
  buildSkipAcceptedSystemSuffix,
  resolveQuestionSkipProgression,
} from '@features/aria/interviewQuestionSkipProgression';
import { getScenarioNumberForNewMessage } from '@features/aria/scenarioNumberDetection';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';

/**
 * Skip acceptance sets continuation suffix and falls through to the model (does not halt the turn).
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
  if (momentNum >= 1 && momentNum <= 3) {
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

  return { haltTurn: false };
}
