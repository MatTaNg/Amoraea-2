import {
  looksLikeMoment4GrudgePrompt,
  looksLikeMoment4ThresholdQuestion,
} from '@features/aria/moment4ProbeLogic';
import { looksLikeMoment4SpecificityFollowUpPrompt } from '@features/aria/moment4SpecificityFollowUp';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  looksLikeMoment5AccountabilityProbeAssistantPrompt,
  looksLikeMoment5ConflictValidityClarificationPrompt,
  looksLikeMoment5SpecificityRedirectPrompt,
  transcriptHasMoment5ResolutionFollowUpAsked,
} from '@features/aria/probeAndScoringUtils';
import {
  moment5DeliveryRefsIndicateQuestionDelivered,
  reconcileMoment5DeliveryFromTranscript,
} from '@features/aria/moment5DeliveryReconcile';

function isNonWelcomeBackAssistantMessage(m: MessageWithScenario): boolean {
  return m.role === 'assistant' && !(m as { isWelcomeBack?: boolean }).isWelcomeBack;
}

/** Increment post-M5-prompt user turn counter when the last interviewer line is a real M5 anchor. */
export function syncMoment5PostPromptUserTurnCount(
  deps: PreClaudeTurnGateDeps,
  lastInterviewerContent: string,
): void {
  if (
    deps.currentInterviewMomentRef.current === 5 &&
    moment5DeliveryRefsIndicateQuestionDelivered(deps) &&
    !looksLikeMoment4ThresholdQuestion(lastInterviewerContent) &&
    !looksLikeMoment4GrudgePrompt(lastInterviewerContent) &&
    !looksLikeMoment4SpecificityFollowUpPrompt(lastInterviewerContent)
  ) {
    deps.moment5PostPromptUserTurnCountRef.current += 1;
  }
}

/**
 * Resume / ref desync: reconcile M5 client-inject flags from transcript when refs lag behind storage.
 */
export function syncMoment5ClientInjectRefsFromTranscript(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
): void {
  if (deps.currentInterviewMomentRef.current !== 5) {
    return;
  }

  reconcileMoment5DeliveryFromTranscript(deps, messagesToUse);

  if (!deps.moment5AccountabilityProbeFiredRef.current) {
    const accountabilityProbeAlreadyInTranscript = messagesToUse.some(
      (m) =>
        isNonWelcomeBackAssistantMessage(m) &&
        looksLikeMoment5AccountabilityProbeAssistantPrompt((m as { content?: string }).content ?? ''),
    );
    if (accountabilityProbeAlreadyInTranscript) {
      deps.moment5AccountabilityProbeFiredRef.current = true;
      deps.moment5ClientScoringMetaRef.current = {
        ...(deps.moment5ClientScoringMetaRef.current ?? {}),
        accountabilityProbeFired: true,
      };
    }
  }

  if (!deps.moment5SpecificityRedirectIssuedRef.current) {
    const redirectAlreadyInTranscript = messagesToUse.some(
      (m) =>
        isNonWelcomeBackAssistantMessage(m) &&
        looksLikeMoment5SpecificityRedirectPrompt((m as { content?: string }).content ?? ''),
    );
    if (redirectAlreadyInTranscript) {
      deps.moment5SpecificityRedirectIssuedRef.current = true;
    }
  }

  if (!deps.moment5ResolutionFollowUpIssuedRef.current) {
    if (transcriptHasMoment5ResolutionFollowUpAsked(messagesToUse)) {
      deps.moment5ResolutionFollowUpIssuedRef.current = true;
    }
  }

  if (!deps.moment5ResolutionDeliveredRef.current) {
    if (transcriptHasMoment5ResolutionFollowUpAsked(messagesToUse)) {
      deps.moment5ResolutionDeliveredRef.current = true;
    }
  }

  if (!deps.moment5ConflictValidityClarificationIssuedRef.current) {
    const clarificationAlreadyInTranscript = messagesToUse.some(
      (m) =>
        isNonWelcomeBackAssistantMessage(m) &&
        looksLikeMoment5ConflictValidityClarificationPrompt((m as { content?: string }).content ?? ''),
    );
    if (clarificationAlreadyInTranscript) {
      deps.moment5ConflictValidityClarificationIssuedRef.current = true;
    }
  }
}
