import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import type { PreClaudeTurnSkipMetaState } from '@features/aria/runPreClaudeTurnOpeningPipeline';
import {
  runPreClaudePostClosingCompletionGate,
} from '@features/aria/runPreClaudePostClosingCompletionGate';
import {
  runPreClaudePostCommitIntroGates,
} from '@features/aria/runPreClaudePostCommitIntroGates';
import {
  runPreClaudeTurnSkipInjectionGates,
} from '@features/aria/runPreClaudeTurnSkipInjectionGates';

export type PreClaudePostCommitGatesResult = {
  handled: boolean;
};

/** Intro, post-closing completion, and skip-injection gates after user turn commit. */
export async function runPreClaudePostCommitGates(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  participantFirstNameForSpoken: string,
  skipMeta: PreClaudeTurnSkipMetaState,
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

  const postClosingCompletion = await runPreClaudePostClosingCompletionGate(deps, trimmed, messagesToUse);
  if (postClosingCompletion.handled) {
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
