import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { transcriptAssistantContainsMoment5PrimaryConflictQuestion } from '@features/aria/probeAndScoringUtils';

/** Set when the scripted M5 resolution follow-up is passed to TTS (not merely staged in transcript). */
export function markMoment5ResolutionFollowUpTtsDelivered(deps: {
  moment5ResolutionDeliveredRef: { current: boolean };
}): void {
  deps.moment5ResolutionDeliveredRef.current = true;
}

type Moment5DeliveryReconcileDeps = {
  currentInterviewMomentRef?: Pick<PreClaudeTurnGateDeps, 'currentInterviewMomentRef'>['currentInterviewMomentRef'];
  moment5QuestionDeliveredRef?: Pick<PreClaudeTurnGateDeps, 'moment5QuestionDeliveredRef'>['moment5QuestionDeliveredRef'];
  moment5PrimaryAnchorDeliveredSessionRef?: Pick<
    PreClaudeTurnGateDeps,
    'moment5PrimaryAnchorDeliveredSessionRef'
  >['moment5PrimaryAnchorDeliveredSessionRef'];
};

function setMoment5DeliveryReconciled(deps: Moment5DeliveryReconcileDeps): void {
  if (deps.moment5QuestionDeliveredRef) {
    deps.moment5QuestionDeliveredRef.current = true;
  }
  if (deps.moment5PrimaryAnchorDeliveredSessionRef) {
    deps.moment5PrimaryAnchorDeliveredSessionRef.current = true;
  }
  if (deps.currentInterviewMomentRef && deps.currentInterviewMomentRef.current < 5) {
    deps.currentInterviewMomentRef.current = 5;
  }
}

type TranscriptMessageLike = {
  role: string;
  content?: string | null;
  isWelcomeBack?: boolean;
};

function isNonWelcomeBackAssistantMessage(m: TranscriptMessageLike): boolean {
  return m.role === 'assistant' && !m.isWelcomeBack;
}

/** True when the transcript already contains the scripted Moment 5 conflict question. */
export function transcriptHasMoment5PrimaryConflictAnchor(
  messages: readonly TranscriptMessageLike[],
): boolean {
  return messages.some(
    (m) =>
      isNonWelcomeBackAssistantMessage(m) &&
      transcriptAssistantContainsMoment5PrimaryConflictQuestion(m.content ?? ''),
  );
}

/**
 * Align live refs with a delivered M5 anchor. Model-delivered M5 handoffs previously set only
 * `moment5PrimaryAnchorDeliveredSessionRef`, leaving `moment5QuestionDeliveredRef` and moment index
 * stale so accountability probes never evaluated.
 */
export function reconcileMoment5DeliveryFromTranscript(
  deps: Moment5DeliveryReconcileDeps,
  messages: readonly TranscriptMessageLike[] | MessageWithScenario[],
): boolean {
  const hasAnchor = transcriptHasMoment5PrimaryConflictAnchor(messages);
  if (!hasAnchor) return false;
  setMoment5DeliveryReconciled(deps);
  return true;
}

/** Post-claude / TTS path: advance Moment 5 delivery refs when assistant copy includes the M5 anchor. */
export function reconcileMoment5DeliveryFromAssistantText(
  deps: Moment5DeliveryReconcileDeps,
  assistantText: string | null | undefined,
): boolean {
  if (!transcriptAssistantContainsMoment5PrimaryConflictQuestion(assistantText ?? '')) {
    return false;
  }
  setMoment5DeliveryReconciled(deps);
  return true;
}

export function moment5DeliveryRefsIndicateQuestionDelivered(deps: Moment5DeliveryReconcileDeps): boolean {
  return (
    deps.moment5QuestionDeliveredRef?.current === true ||
    deps.moment5PrimaryAnchorDeliveredSessionRef?.current === true
  );
}
