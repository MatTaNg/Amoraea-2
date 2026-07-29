import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import type { PreClaudeTurnSkipMetaState } from '@features/aria/runPreClaudeTurnOpeningPipeline';
import {
  deliverClientOwnedScenario2OpeningAfterS1Repair,
  deliverClientOwnedScenario3OpeningAfterS2Repair,
} from '@features/aria/deliverClientOwnedScenarioHandoffOpening';
import {
  runPreClaudePostClosingCompletionGate,
} from '@features/aria/runPreClaudePostClosingCompletionGate';
import {
  runPreClaudePostCommitIntroGates,
} from '@features/aria/runPreClaudePostCommitIntroGates';
import {
  runPreClaudeGoBackRequestInjectGate,
} from '@features/aria/runPreClaudeGoBackRequestInjectGate';
import {
  runPreClaudeScoreRequestInjectGate,
} from '@features/aria/runPreClaudeScoreRequestInjectGate';
import {
  runPreClaudeTurnSkipInjectionGates,
} from '@features/aria/runPreClaudeTurnSkipInjectionGates';

export type PreClaudePostCommitGatesResult = {
  handled: boolean;
};

/** Intro-only post-commit gates (readiness / S1 vignette) — runs before construct-probe intercepts. */
export async function runPreClaudePostCommitIntroGatesOnly(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  participantFirstNameForSpoken: string,
): Promise<PreClaudePostCommitGatesResult> {
  const introGate = await runPreClaudePostCommitIntroGates(
    deps,
    trimmed,
    messagesToUse,
    participantFirstNameForSpoken,
  );
  if (introGate.handled) {
    return { handled: true };
  }
  return { handled: false };
}

/** S2/S3 handoffs, post-closing, and skip injection — runs after construct-probe intercepts. */
export async function runPreClaudePostCommitHandoffAndSkipGates(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  participantFirstNameForSpoken: string,
  skipMeta: PreClaudeTurnSkipMetaState,
): Promise<PreClaudePostCommitGatesResult> {
  const deliveredS2 = await deliverClientOwnedScenario2OpeningAfterS1Repair(
    deps,
    messagesToUse,
    participantFirstNameForSpoken,
  );
  if (deliveredS2) {
    return { handled: true };
  }

  const deliveredS3 = await deliverClientOwnedScenario3OpeningAfterS2Repair(
    deps,
    messagesToUse,
    participantFirstNameForSpoken,
  );
  if (deliveredS3) {
    return { handled: true };
  }

  const postClosingCompletion = await runPreClaudePostClosingCompletionGate(deps, trimmed, messagesToUse);
  if (postClosingCompletion.handled) {
    return { handled: true };
  }

  const scoreRequest = await runPreClaudeScoreRequestInjectGate(deps, trimmed, messagesToUse);
  if (scoreRequest?.haltTurn) {
    return { handled: true };
  }

  const goBackRequest = await runPreClaudeGoBackRequestInjectGate(deps, trimmed, messagesToUse);
  if (goBackRequest?.haltTurn) {
    return { handled: true };
  }

  const skipInjection = await runPreClaudeTurnSkipInjectionGates(deps, {
    trimmed,
    messagesToUse,
    frustrationSkipDeclinePipeline: skipMeta.frustrationSkipDeclinePipeline,
    skipConfirmationGreetingReconnectInjection: skipMeta.skipConfirmationGreetingReconnectInjection,
    inabilityInvitationClientInjection: skipMeta.inabilityInvitationClientInjection,
    inabilityEscalationSkipInjection: skipMeta.inabilityEscalationSkipInjection,
    proactiveScenarioSkipConfirmationInjection: skipMeta.proactiveScenarioSkipConfirmationInjection,
    skipRequestMetaConfirmationInjection: skipMeta.skipRequestMetaConfirmationInjection,
    frustrationSkipAcceptancePipeline: skipMeta.frustrationSkipAcceptancePipeline,
    skipRequestConfirmationSpeech: skipMeta.skipRequestConfirmationSpeech,
  });
  if (skipInjection.haltTurn) {
    return { handled: true };
  }

  return { handled: false };
}

/** Intro, client-owned S2/S3 opens, post-closing completion, and skip-injection gates after user turn commit. */
export async function runPreClaudePostCommitGates(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  participantFirstNameForSpoken: string,
  skipMeta: PreClaudeTurnSkipMetaState,
): Promise<PreClaudePostCommitGatesResult> {
  const intro = await runPreClaudePostCommitIntroGatesOnly(
    deps,
    trimmed,
    messagesToUse,
    participantFirstNameForSpoken,
  );
  if (intro.handled) {
    return { handled: true };
  }

  return runPreClaudePostCommitHandoffAndSkipGates(
    deps,
    trimmed,
    messagesToUse,
    participantFirstNameForSpoken,
    skipMeta,
  );
}
