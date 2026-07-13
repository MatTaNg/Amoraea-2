import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { getScenarioNumberForNewMessage } from '@features/aria/scenarioNumberDetection';

export type PreClaudeTurnSkipInjectionArgs = {
  trimmed: string;
  messagesToUse: MessageWithScenario[];
  frustrationSkipDeclinePipeline: boolean;
  skipConfirmationGreetingReconnectInjection: boolean;
  inabilityInvitationClientInjection: boolean;
  inabilityEscalationSkipInjection: boolean;
  proactiveScenarioSkipConfirmationInjection: boolean;
  skipRequestMetaConfirmationInjection: boolean;
  frustrationSkipAcceptancePipeline: boolean;
  skipRequestConfirmationSpeech: string;
};

export type PreClaudeTurnSkipInjectionResult = {
  haltTurn: boolean;
};

export function isPreClaudeTurnSkipInjectionRouteActive(deps: PreClaudeTurnGateDeps): boolean {
  return deps.isInterviewAppRoute && !deps.isAdmin && deps.status === 'active';
}

export function scenarioTagForSkipMoment(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
): number {
  let tag =
    (deps.currentScenarioRef.current as number | undefined) ??
    getScenarioNumberForNewMessage(messagesToUse, 'user');
  if (deps.currentInterviewMomentRef.current >= 4) {
    tag = 3;
  }
  return tag;
}

export function finishPreClaudeSkipInjectionTurn(
  deps: PreClaudeTurnGateDeps,
): PreClaudeTurnSkipInjectionResult {
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  return { haltTurn: true };
}
