import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import { resolvePreClaudeFrustrationSkipGates } from '@features/aria/resolvePreClaudeFrustrationSkipGates';
import { resolvePreClaudeMetaCommentGateState } from '@features/aria/resolvePreClaudeMetaCommentGateState';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';

export type { PreClaudeFrustrationSkipGateState } from '@features/aria/resolvePreClaudeFrustrationSkipGates';
export { resolvePreClaudeFrustrationSkipGates } from '@features/aria/resolvePreClaudeFrustrationSkipGates';
export { resolvePreClaudeMetaCommentGateState } from '@features/aria/resolvePreClaudeMetaCommentGateState';

export type PreClaudeTurnSkipAndMetaGateResult = {
  frustrationSkipAcceptancePipeline: boolean;
  frustrationSkipDeclinePipeline: boolean;
  proactiveScenarioSkipConfirmationInjection: boolean;
  skipConfirmationGreetingReconnectInjection: boolean;
  metaCommentClassification: MetaCommentClassification | null;
  metaClassSnapshotPrePipeline: MetaCommentClassification | null;
  alreadyAnsweredPriorSubstantiveVerified: boolean | undefined;
  inabilityCountInMomentLog: number | undefined;
  inabilityEscalatedToSkipLog: boolean | undefined;
  checkingInFrustrationAdjacent: boolean;
  skipRequestConfirmationSpeech: string;
  inabilityInvitationClientInjection: boolean;
  inabilityEscalationSkipInjection: boolean;
  skipRequestMetaConfirmationInjection: boolean;
  repeatedFrustrationInMoment: boolean;
  suppressForcedConstructProbesForMetaFrustration: boolean;
};

/** Frustration/proactive skip pipelines, meta-comment classification, and related telemetry. */
export async function resolvePreClaudeTurnSkipAndMetaGates(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  resumeGatePendingEarly: boolean,
): Promise<PreClaudeTurnSkipAndMetaGateResult> {
  const frustrationSkip = resolvePreClaudeFrustrationSkipGates(deps, trimmed);
  return resolvePreClaudeMetaCommentGateState(
    deps,
    trimmed,
    resumeGatePendingEarly,
    frustrationSkip,
  );
}
