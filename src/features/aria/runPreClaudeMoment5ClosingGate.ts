import { deliverClientOwnedMoment5InterviewComplete } from '@features/aria/deliverClientOwnedMoment5InterviewComplete';
import { looksLikeInterviewStillOpenCheck } from '@features/aria/interviewPriorAnswerMetaDetection';
import { computeMoment5InterviewCloseGate } from '@features/aria/interviewProgressSync';
import type { InterviewTurnOrchestratorDecision } from '@features/aria/interviewTurnOrchestratorTypes';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';

export type PreClaudeMoment5ClosingGateResult = {
  handled: boolean;
};

/**
 * When M5 is substantively complete (close gate passes, no pending probes), deliver the
 * client-owned closing instead of delegating to Claude — prevents ad-hoc follow-up questions.
 */
export async function runPreClaudeMoment5ClosingGate(args: {
  deps: PreClaudeTurnGateDeps;
  messagesToUse: MessageWithScenario[];
  moment5CombinedUserText: string;
  decision: InterviewTurnOrchestratorDecision;
}): Promise<PreClaudeMoment5ClosingGateResult> {
  const { deps, messagesToUse, moment5CombinedUserText, decision } = args;

  if (deps.currentInterviewMomentRef.current !== 5) {
    return { handled: false };
  }
  const lastUserText =
    [...messagesToUse].reverse().find((m) => m.role === 'user')?.content ?? '';
  if (looksLikeInterviewStillOpenCheck(lastUserText)) {
    return { handled: false };
  }
  if (decision.pendingProbeId != null) {
    return { handled: false };
  }
  if (!decision.satisfiedProbeIds.includes('m5_conflict')) {
    return { handled: false };
  }
  if (decision.action.kind !== 'delegate_claude') {
    return { handled: false };
  }
  if (decision.userIntent !== 'substantive_answer' && decision.userIntent !== 'unclear') {
    return { handled: false };
  }

  const closeGate = computeMoment5InterviewCloseGate(messagesToUse, {
    moment5QuestionDelivered: deps.moment5QuestionDeliveredRef.current,
    moment5PrimaryAnchorSession: deps.moment5PrimaryAnchorDeliveredSessionRef.current,
    postM5UserTurnsRef: deps.moment5PostPromptUserTurnCountRef.current,
    accountabilityProbeFired: deps.moment5AccountabilityProbeFiredRef.current,
    currentInterviewMoment: deps.currentInterviewMomentRef.current,
    moment5ResolutionDelivered: deps.moment5ResolutionDeliveredRef.current,
  });

  if (!closeGate.moment5CloseAllowed) {
    return { handled: false };
  }

  await deliverClientOwnedMoment5InterviewComplete(deps, messagesToUse, 'm5_substantive_close');
  return { handled: true };
}
