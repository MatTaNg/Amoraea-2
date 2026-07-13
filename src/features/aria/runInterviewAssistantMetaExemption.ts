import type { InterviewAssistantMetaExemptionDeps } from '@features/aria/interviewAssistantMetaExemptionTypes';

export function runRecordInterviewAssistantDeliveryForMetaExemption(
  deps: InterviewAssistantMetaExemptionDeps,
  deliveredQuestionText: string,
): void {
  const cleaned = deps.stripControlTokens(deliveredQuestionText).trim();
  if (!cleaned) return;
  if (deps.countsAsSubstantiveInterviewQuestionDelivery(cleaned)) {
    deps.substantiveInterviewQuestionDeliveredSeqRef.current += 1;
    deps.metaCommentAckAwaitingSubstantiveBaselineSeqRef.current = null;
  }
}

export function runFinalizePendingMetaAckBaselineAfterAssistantText(
  deps: InterviewAssistantMetaExemptionDeps,
  fullAssistantText: string,
): void {
  const pendingMeta = deps.metaClassificationForPendingAssistantRef.current;
  if (pendingMeta == null) return;
  deps.metaClassificationForPendingAssistantRef.current = null;
  const cleaned = deps.stripControlTokens(fullAssistantText).trim();
  if (!cleaned) return;
  if (!deps.countsAsSubstantiveInterviewQuestionDelivery(cleaned)) {
    deps.metaCommentAckAwaitingSubstantiveBaselineSeqRef.current =
      deps.substantiveInterviewQuestionDeliveredSeqRef.current;
  }
}
