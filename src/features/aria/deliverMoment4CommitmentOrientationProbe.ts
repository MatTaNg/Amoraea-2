import { looksLikeGoBackToPreviousScenarioRequest } from '@features/aria/interviewGoBackRequest';
import { looksLikeIncompleteCutOffUserAnswer } from '@features/aria/interviewAnswerRelevance';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import {
  MOMENT_4_COMMITMENT_ORIENTATION_FROM_GRUDGE_SPOKEN,
  MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
  transcriptIncludesAssistantMatch,
  looksLikeMoment4OrientationQuestion,
  userLacksLivedSupportSituation,
} from '@features/aria/moment4ProbeLogic';
import { applyInterviewCanonicalProbeSideEffects } from '@features/aria/interviewCanonicalProbeDeliveryShared';
import { applyMoment4OrientationReferenceCard } from '@features/aria/interviewReferenceCardResumeHelpers';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { remoteLog } from '@utilities/remoteLog';

function spokenMoment4OrientationProbe(withBriefAck: boolean): string {
  if (!withBriefAck) return MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT;
  return MOMENT_4_COMMITMENT_ORIENTATION_FROM_GRUDGE_SPOKEN;
}

/** Deliver M4 commitment-orientation probe — shared by specificity gate and orchestrator executor. */
export async function deliverMoment4CommitmentOrientationProbe(args: {
  deps: PreClaudeTurnGateDeps;
  trimmed: string;
  messagesToUse: MessageWithScenario[];
  logTag: string;
  /** Receipt of the prior answer ("Got it.") before the keep-investing question. Default true. */
  withBriefAck?: boolean;
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
  } else if (
    transcriptIncludesAssistantMatch(args.messagesToUse, looksLikeMoment4OrientationQuestion)
  ) {
    blockReason = 'orientation_already_in_transcript';
  } else if (looksLikeIncompleteCutOffUserAnswer(args.trimmed)) {
    blockReason = 'incomplete_cutoff_answer';
  } else if (looksLikeGoBackToPreviousScenarioRequest(args.trimmed)) {
    blockReason = 'go_back_request';
  }
  if (blockReason) {
    return false;
  }

  const orientationProbeText = spokenMoment4OrientationProbe(
    args.withBriefAck !== false && !userLacksLivedSupportSituation(args.trimmed),
  );

  void remoteLog(args.logTag, {
    interviewSessionId: args.deps.interviewSessionIdRef.current,
    preview: orientationProbeText.slice(0, 240),
  });

  if (args.deps.parallelStreamingTtsRef.current.active) {
    args.deps.parallelStreamingTtsRef.current.cancelRequested = true;
  }

  args.deps.probeLogRef.current.push({
    scenario: (args.deps.currentScenarioRef.current ?? 3) as number,
    construct: 'commitment_orientation',
    probe_fired: true,
    trigger_reason: 'orchestrator_execute_m4_orientation',
    pre_probe_score: 0,
    post_probe_score: 0,
    score_delta: 0,
  });

  const scenarioNumber = ((args.deps.currentScenarioRef.current as 1 | 2 | 3 | undefined) ?? 3) as 1 | 2 | 3;
  const orientationMsg: MessageWithScenario = {
    role: 'assistant',
    content: orientationProbeText,
    scenarioNumber,
  };
  args.deps.setMessages([...args.messagesToUse, orientationMsg]);
  applyMoment4OrientationReferenceCard(args.deps);
  await args.deps.speakTextSafe(orientationProbeText, ASSISTANT_INTERVIEW_SPEECH);

  applyInterviewCanonicalProbeSideEffects(
    args.deps,
    'm4_commitment_orientation',
    orientationProbeText,
  );
  args.deps.setVoiceState('idle');
  args.deps.setIsWaiting(false);
  return true;
}
