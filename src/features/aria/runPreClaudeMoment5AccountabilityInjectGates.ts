import { buildPreClaudeMoment5AccountabilityEvalContext } from '@features/aria/buildPreClaudeMoment5AccountabilityEvalContext';
import { looksLikeIncompleteCutOffUserAnswer } from '@features/aria/interviewAnswerRelevance';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { reconcileMoment5DeliveryFromTranscript, moment5DeliveryRefsIndicateQuestionDelivered, transcriptHasMoment5PrimaryConflictAnchor } from '@features/aria/moment5DeliveryReconcile';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  logPreClaudeMoment5AccountabilityEvalTelemetry,
  logPreClaudeMoment5AccountabilityProbeSkipped,
} from '@features/aria/logPreClaudeMoment5AccountabilityTelemetry';
import type { PreClaudeMoment5AccountabilityInjectGatesResult } from '@features/aria/preClaudeMoment5AccountabilityInjectShared';
import { runPreClaudeMoment5AccountabilityProbeInjectGate } from '@features/aria/runPreClaudeMoment5AccountabilityProbeInjectGate';
import { runPreClaudeMoment5ConflictValidityClarificationGate } from '@features/aria/runPreClaudeMoment5ConflictValidityClarificationGate';
import { runPreClaudeMoment5PersistentAbstractMoveOnGate } from '@features/aria/runPreClaudeMoment5PersistentAbstractMoveOnGate';
import { runPreClaudeMoment5ResolutionFollowUpGate } from '@features/aria/runPreClaudeMoment5ResolutionFollowUpGate';
import { runPreClaudeMoment5SpecificityRedirectGate } from '@features/aria/runPreClaudeMoment5SpecificityRedirectGate';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import { shouldDeferGatesForDedicatedMetaHandling } from '@features/aria/metaCommentDedicatedPostCommitDeferral';

export type { PreClaudeMoment5AccountabilityInjectGatesResult } from '@features/aria/preClaudeMoment5AccountabilityInjectShared';

/**
 * Moment 5 accountability eval, conflict-validity clarification, specificity redirects, resolution follow-up, and probe injects.
 */
export async function runPreClaudeMoment5AccountabilityInjectGates(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  lastInterviewerContent: string,
  metaCommentClassification: MetaCommentClassification | null = null,
): Promise<PreClaudeMoment5AccountabilityInjectGatesResult> {
  reconcileMoment5DeliveryFromTranscript(deps, messagesToUse);
  if (shouldDeferGatesForDedicatedMetaHandling(metaCommentClassification, trimmed)) {
    return { handled: false, moment5CombinedUserText: trimmed };
  }
  if (looksLikeIncompleteCutOffUserAnswer(trimmed)) {
    console.log('[M5] accountability inject gates — skip cut-off answer', {
      attemptId: deps.interviewSessionAttemptIdRef.current ?? null,
      preview: trimmed.slice(0, 120),
    });
    return { handled: false, moment5CombinedUserText: trimmed };
  }
  console.log('[M5] accountability inject gates — entry', {
    attemptId: deps.interviewSessionAttemptIdRef.current ?? null,
    responseWordCount: trimmed.trim().split(/\s+/).filter(Boolean).length,
    m5DeliveredRefs: moment5DeliveryRefsIndicateQuestionDelivered(deps),
    m5AnchorInTranscript: transcriptHasMoment5PrimaryConflictAnchor(messagesToUse),
    lastInterviewerPreview: lastInterviewerContent.slice(0, 120),
  });
  const ctx = buildPreClaudeMoment5AccountabilityEvalContext(deps, trimmed, messagesToUse, lastInterviewerContent);
  console.log('[M5] accountability probe eval', {
    candidate: ctx.moment5AccountabilityProbeCandidate,
    shouldProbe: ctx.moment5AccountabilityEval.shouldProbe,
    reason: ctx.moment5AccountabilityEval.reason,
    selfAccountabilityEstablished: ctx.moment5SelfAccountabilityAlreadyEstablished,
    hasExplicitSelfAccountability: ctx.moment5AccountabilityEval.reason === 'explicit_self_accountability',
  });

  logPreClaudeMoment5AccountabilityEvalTelemetry(deps, trimmed, ctx);

  const conflictValidity = await runPreClaudeMoment5ConflictValidityClarificationGate(
    deps,
    trimmed,
    messagesToUse,
    ctx,
  );
  if (conflictValidity) {
    return conflictValidity;
  }

  const persistentAbstract = await runPreClaudeMoment5PersistentAbstractMoveOnGate(
    deps,
    trimmed,
    messagesToUse,
    ctx,
  );
  if (persistentAbstract) {
    return persistentAbstract;
  }

  const specificityRedirect = await runPreClaudeMoment5SpecificityRedirectGate(
    deps,
    trimmed,
    messagesToUse,
    ctx,
  );
  if (specificityRedirect) {
    return specificityRedirect;
  }

  const resolutionFollowUp = await runPreClaudeMoment5ResolutionFollowUpGate(
    deps,
    trimmed,
    messagesToUse,
    lastInterviewerContent,
    ctx,
  );
  if (resolutionFollowUp) {
    return resolutionFollowUp;
  }

  const accountabilityProbe = await runPreClaudeMoment5AccountabilityProbeInjectGate(
    deps,
    trimmed,
    messagesToUse,
    ctx,
  );
  if (accountabilityProbe) {
    return accountabilityProbe;
  }

  if (ctx.moment5AccountabilityProbeCandidate && !ctx.moment5AccountabilityEval.shouldProbe) {
    logPreClaudeMoment5AccountabilityProbeSkipped(deps, trimmed, ctx);
  }

  return { handled: false, moment5CombinedUserText: ctx.moment5CombinedUserText };
}
