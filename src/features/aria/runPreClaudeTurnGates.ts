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
  runPreClaudePostCommitHandoffAndSkipGates,
  runPreClaudePostCommitIntroGatesOnly,
} from '@features/aria/runPreClaudePostCommitGates';
import {
  runPreClaudePreCommitGates,
} from '@features/aria/runPreClaudePreCommitGates';
import {
  runPreClaudeTurnOpeningPipeline,
} from '@features/aria/runPreClaudeTurnOpeningPipeline';
import type { PreClaudeTurnGateDeps, PreClaudeTurnGateParams } from '@features/aria/preClaudeTurnGateTypes';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { triggerLiveMoment4ScoringOnM5Entry } from '@features/aria/liveMoment4ScoringOnM5Entry';
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

  const m5DeliveredBeforeReconcile = deps.moment5QuestionDeliveredRef.current === true;
  reconcileMoment5DeliveryFromTranscript(deps, deps.messages as MessageWithScenario[]);
  if (!m5DeliveredBeforeReconcile && deps.moment5QuestionDeliveredRef.current === true) {
    triggerLiveMoment4ScoringOnM5Entry({
      trigger: 'm5_reconcile_from_transcript',
      userId: deps.userId,
      isAdmin: deps.isAdmin,
      attemptId: deps.interviewSessionAttemptIdRef.current,
      messages: deps.messages as MessageWithScenario[],
      deferredMoment4NarrativeRef: deps.deferredMoment4NarrativeRef,
      moment4SpecificityScoringRef: deps.moment4SpecificityScoringRef,
    });
  }

  const userTurn = await commitPreClaudeUserTurn(deps, params.trimmed);
  const { messagesToUse, userScenarioTag } = userTurn;
  logPreClaudeTurnResponseTiming(deps, params.trimmed);

  const postCommitIntro = await runPreClaudePostCommitIntroGatesOnly(
    deps,
    params.trimmed,
    messagesToUse,
    participantFirstNameForSpoken,
  );
  if (postCommitIntro.handled) {
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

  const postCommitHandoff = await runPreClaudePostCommitHandoffAndSkipGates(
    deps,
    params.trimmed,
    messagesToUse,
    participantFirstNameForSpoken,
    skipMeta,
  );
  if (postCommitHandoff.handled) {
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
