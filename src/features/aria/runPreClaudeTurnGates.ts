import {
  assertPreClaudeAnthropicConfigured,
} from '@features/aria/assertPreClaudeAnthropicConfigured';
import {
  buildPreClaudeTurnApiParams,
} from '@features/aria/buildPreClaudeTurnApiParams';
import {
  commitPreClaudeUserTurn,
} from '@features/aria/commitPreClaudeUserTurn';
import {
  logPreClaudeTurnResponseTiming,
} from '@features/aria/logPreClaudeTurnSessionTelemetry';
import {
  runPreClaudeLateInterceptGates,
} from '@features/aria/runPreClaudeLateInterceptGates';
import {
  runPreClaudePostCommitGates,
} from '@features/aria/runPreClaudePostCommitGates';
import {
  runPreClaudePreCommitGates,
} from '@features/aria/runPreClaudePreCommitGates';
import {
  runPreClaudeTurnOpeningPipeline,
} from '@features/aria/runPreClaudeTurnOpeningPipeline';
import type { PreClaudeTurnGateDeps, PreClaudeTurnGateParams } from '@features/aria/preClaudeTurnGateTypes';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { reconcileMoment5DeliveryFromTranscript } from '@features/aria/moment5DeliveryReconcile';

export async function runPreClaudeTurnGates(
  deps: PreClaudeTurnGateDeps,
  params: PreClaudeTurnGateParams,
): Promise<boolean> {
  const opening = await runPreClaudeTurnOpeningPipeline(deps, params);
  if (!opening.continue) {
    return false;
  }

  let { participantFirstNameForSpoken, skipMeta } = opening;

  const preCommit = await runPreClaudePreCommitGates(deps, params.trimmed, participantFirstNameForSpoken);
  participantFirstNameForSpoken = preCommit.participantFirstNameForSpoken;
  if (preCommit.handled) {
    return false;
  }

  reconcileMoment5DeliveryFromTranscript(deps, deps.messages as MessageWithScenario[]);

  const userTurn = await commitPreClaudeUserTurn(deps, params.trimmed);
  const { messagesToUse, userScenarioTag } = userTurn;
  logPreClaudeTurnResponseTiming(deps, params.trimmed);

  const postCommit = await runPreClaudePostCommitGates(
    deps,
    params.trimmed,
    messagesToUse,
    participantFirstNameForSpoken,
    skipMeta,
  );
  if (postCommit.handled) {
    return false;
  }

  const lateIntercept = await runPreClaudeLateInterceptGates(
    deps,
    params.trimmed,
    messagesToUse,
    userScenarioTag,
    participantFirstNameForSpoken,
    skipMeta.metaCommentClassification,
    preCommit.isNameEntryTurn,
    skipMeta.suppressForcedConstructProbesForMetaFrustration,
  );
  if (lateIntercept.handled) {
    return false;
  }

  if (!assertPreClaudeAnthropicConfigured(deps)) {
    return false;
  }

  buildPreClaudeTurnApiParams(deps, params, {
    messagesToUse,
    userScenarioTag,
    participantFirstNameForSpoken,
    isPersonalOpening: lateIntercept.isPersonalOpening,
    lastAssistantContent: lateIntercept.lastAssistantContent,
    isNameEntryTurn: preCommit.isNameEntryTurn,
    trimmed: params.trimmed,
    shouldForceMoment4ThresholdProbe: lateIntercept.shouldForceMoment4ThresholdProbe,
    moment4ThresholdHintInAnswer: lateIntercept.moment4ThresholdHintInAnswer,
    moment5CombinedUserText: lateIntercept.moment5CombinedUserText,
    metaCommentClassification: skipMeta.metaCommentClassification,
    repeatedFrustrationInMoment: skipMeta.repeatedFrustrationInMoment,
    alreadyAnsweredPriorSubstantiveVerified: skipMeta.alreadyAnsweredPriorSubstantiveVerified,
    checkingInFrustrationAdjacent: skipMeta.checkingInFrustrationAdjacent,
    suppressForcedConstructProbesForMetaFrustration: skipMeta.suppressForcedConstructProbesForMetaFrustration,
    frustrationSkipAcceptancePipeline: skipMeta.frustrationSkipAcceptancePipeline,
    frustrationSkipDeclinePipeline: skipMeta.frustrationSkipDeclinePipeline,
    proactiveScenarioSkipConfirmationInjection: skipMeta.proactiveScenarioSkipConfirmationInjection,
    constructProbeFlags: lateIntercept.constructProbeFlags,
  });
  return true;
}
