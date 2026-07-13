import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { runPreClaudeFrustrationSkipAcceptanceGate } from '@features/aria/runPreClaudeFrustrationSkipAcceptanceGate';
import { runPreClaudeFrustrationSkipDeclineGate } from '@features/aria/runPreClaudeFrustrationSkipDeclineGate';
import { runPreClaudeInabilityEscalationSkipGate } from '@features/aria/runPreClaudeInabilityEscalationSkipGate';
import { runPreClaudeInabilityInvitationInjectGate } from '@features/aria/runPreClaudeInabilityInvitationInjectGate';
import { runPreClaudeProactiveScenarioSkipConfirmationGate } from '@features/aria/runPreClaudeProactiveScenarioSkipConfirmationGate';
import { runPreClaudeSkipConfirmationGreetingReconnectGate } from '@features/aria/runPreClaudeSkipConfirmationGreetingReconnectGate';
import { runPreClaudeSkipRequestMetaConfirmationGate } from '@features/aria/runPreClaudeSkipRequestMetaConfirmationGate';
import type {
  PreClaudeTurnSkipInjectionArgs,
  PreClaudeTurnSkipInjectionResult,
} from '@features/aria/preClaudeTurnSkipInjectionShared';

export type {
  PreClaudeTurnSkipInjectionArgs,
  PreClaudeTurnSkipInjectionResult,
} from '@features/aria/preClaudeTurnSkipInjectionShared';

/**
 * Client-injected skip / inability / frustration confirmation turns (TTS + state).
 * Skip acceptance sets continuation suffix and falls through to the model.
 */
export async function runPreClaudeTurnSkipInjectionGates(
  deps: PreClaudeTurnGateDeps,
  args: PreClaudeTurnSkipInjectionArgs,
): Promise<PreClaudeTurnSkipInjectionResult> {
  const { messagesToUse } = args;

  if (args.frustrationSkipDeclinePipeline) {
    const decline = await runPreClaudeFrustrationSkipDeclineGate(deps, messagesToUse);
    if (decline) {
      return decline;
    }
  }

  if (args.skipConfirmationGreetingReconnectInjection) {
    const greetingReconnect = await runPreClaudeSkipConfirmationGreetingReconnectGate(deps, messagesToUse);
    if (greetingReconnect) {
      return greetingReconnect;
    }
  }

  if (args.inabilityInvitationClientInjection) {
    const inabilityInvite = await runPreClaudeInabilityInvitationInjectGate(deps, messagesToUse);
    if (inabilityInvite) {
      return inabilityInvite;
    }
  }

  if (args.inabilityEscalationSkipInjection) {
    const inabilityEscalation = await runPreClaudeInabilityEscalationSkipGate(deps, messagesToUse);
    if (inabilityEscalation) {
      return inabilityEscalation;
    }
  }

  if (args.proactiveScenarioSkipConfirmationInjection) {
    const proactiveSkip = await runPreClaudeProactiveScenarioSkipConfirmationGate(
      deps,
      args.trimmed,
      messagesToUse,
    );
    if (proactiveSkip) {
      return proactiveSkip;
    }
  }

  if (args.skipRequestMetaConfirmationInjection) {
    const metaSkip = await runPreClaudeSkipRequestMetaConfirmationGate(
      deps,
      messagesToUse,
      args.skipRequestConfirmationSpeech,
    );
    if (metaSkip) {
      return metaSkip;
    }
  }

  if (args.frustrationSkipAcceptancePipeline) {
    const acceptance = await runPreClaudeFrustrationSkipAcceptanceGate(deps, messagesToUse);
    if (acceptance) {
      return acceptance;
    }
  }

  return { haltTurn: false };
}
