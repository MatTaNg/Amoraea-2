import { countInterviewWords } from '@features/aria/moment4SpecificityFollowUp';
import { moment5DeliveryRefsIndicateQuestionDelivered } from '@features/aria/moment5DeliveryReconcile';
import type { PreClaudeMoment5AccountabilityEvalContext } from '@features/aria/buildPreClaudeMoment5AccountabilityEvalContext';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';

export function logPreClaudeMoment5AccountabilityEvalTelemetry(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  ctx: Pick<
    PreClaudeMoment5AccountabilityEvalContext,
    'moment5AccountabilityEval' | 'moment5AnsweringAfterConflictValidityClarification' | 'moment5ConflictValidityClassification'
  >,
): void {
  if (deps.currentInterviewMomentRef.current !== 5 || !moment5DeliveryRefsIndicateQuestionDelivered(deps)) {
    return;
  }

  void remoteLog('[M5_ACCOUNTABILITY_SELF_REFERENCE_EVAL]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    should_probe: ctx.moment5AccountabilityEval.shouldProbe,
    probe_reason: ctx.moment5AccountabilityEval.reason,
    accountability_probe_self_reference_detected:
      ctx.moment5AccountabilityEval.selfReference.accountability_probe_self_reference_detected,
    self_reference_type: ctx.moment5AccountabilityEval.selfReference.self_reference_type,
    moment_5_clarification_fired: deps.moment5ConflictValidityClarificationIssuedRef.current,
    wordCount: countInterviewWords(trimmed),
    preview: trimmed.slice(0, 200),
  });

  if (deps.userId) {
    const r = getSessionLogRuntime();
    writeSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'moment_5_session_state',
      eventData: {
        moment_number: 5,
        moment_5_clarification_fired: deps.moment5ConflictValidityClarificationIssuedRef.current,
        accountability_probe_fired: deps.moment5AccountabilityProbeFiredRef.current,
        should_probe: ctx.moment5AccountabilityEval.shouldProbe,
        probe_reason: ctx.moment5AccountabilityEval.reason,
        answering_after_conflict_validity_clarification: ctx.moment5AnsweringAfterConflictValidityClarification,
      },
      platform: r.platform,
    });
  }

  if (ctx.moment5AnsweringAfterConflictValidityClarification && ctx.moment5ConflictValidityClassification) {
    deps.moment5ClientScoringMetaRef.current = {
      ...(deps.moment5ClientScoringMetaRef.current ?? {}),
      accountabilityProbeFired: deps.moment5ClientScoringMetaRef.current?.accountabilityProbeFired ?? false,
      conflictValidityClarificationAsked: true,
      conflictValidity: ctx.moment5ConflictValidityClassification,
    };
    void remoteLog('[M5_CONFLICT_VALIDITY_CLASSIFIED]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      conflict_validity: ctx.moment5ConflictValidityClassification,
      wordCount: countInterviewWords(trimmed),
      preview: trimmed.slice(0, 200),
    });
  }
}

export function logPreClaudeMoment5AccountabilityProbeSkipped(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  ctx: Pick<PreClaudeMoment5AccountabilityEvalContext, 'moment5AccountabilityEval'>,
): void {
  void remoteLog('[M5_ACCOUNTABILITY_PROBE_SKIPPED]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    reason: ctx.moment5AccountabilityEval.reason,
    accountability_probe_self_reference_detected:
      ctx.moment5AccountabilityEval.selfReference.accountability_probe_self_reference_detected,
    self_reference_type: ctx.moment5AccountabilityEval.selfReference.self_reference_type,
    wordCount: countInterviewWords(trimmed),
    preview: trimmed.slice(0, 200),
  });
}
