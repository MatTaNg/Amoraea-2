import {
  evaluateHybridCutOffDetection,
  looksLikeStructuralCutOffUserAnswer,
} from '@features/aria/interviewCutOffDetection';
import {
  looksLikeInterviewerIdentityOrOffTopicAsk,
  looksLikeInterviewProcessMetaComment,
  looksLikeInterviewProcessQuestionRepeatRequest,
  looksLikeRepairQuestionEchoAnswer,
} from '@features/aria/interviewAnswerRelevance';
import type { UserTurnMicStopTelemetry } from '@features/aria/interviewCutOffDetectionTypes';
import { INTERVIEW_TURN_ORCHESTRATOR_PHASE2_ENABLED } from '@features/aria/interviewTurnOrchestratorConfig';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';

/**
 * When true, skip client-owned meta recovery lines and let Claude respond in character,
 * then gently return to the active interview beat.
 */
export function shouldBypassLegacyMetaInjectForClaude(
  trimmed: string,
  meta: MetaCommentClassification | null,
  micStopTelemetry?: UserTurnMicStopTelemetry | null,
): boolean {
  if (!INTERVIEW_TURN_ORCHESTRATOR_PHASE2_ENABLED) return false;

  const t = (trimmed ?? '').trim();
  if (!t) return false;

  const cutOff = evaluateHybridCutOffDetection({
    transcriptText: t,
    telemetry: micStopTelemetry,
  });
  if (cutOff.isCutOff) return false;

  // Mic cut-offs / repair echoes still use the legacy recovery line for now.
  if (looksLikeStructuralCutOffUserAnswer(t)) return false;
  if (looksLikeRepairQuestionEchoAnswer(t)) return false;

  if (looksLikeInterviewProcessQuestionRepeatRequest(t)) return false;
  if (looksLikeInterviewerIdentityOrOffTopicAsk(t)) return true;
  if (looksLikeInterviewProcessMetaComment(t)) return true;

  if (meta?.type === 'confusion' && meta.confusion_subtype !== 'repeat_request') {
    return true;
  }
  if (meta?.type === 'ambiguous_short') return true;

  return false;
}

/** Content-confusion "want me to repeat?" offer — Phase 2 uses Claude instead. */
export function shouldBypassConfusionRepeatOfferForClaude(
  meta: MetaCommentClassification | null,
): boolean {
  if (!INTERVIEW_TURN_ORCHESTRATOR_PHASE2_ENABLED) return false;
  return meta?.type === 'confusion' && meta.confusion_subtype !== 'repeat_request';
}
