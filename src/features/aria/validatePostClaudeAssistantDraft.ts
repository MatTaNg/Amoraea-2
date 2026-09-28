import {
  INTERVIEW_CANONICAL_PROBES,
  type InterviewCanonicalProbeId,
} from '@features/aria/interviewCanonicalProbeRegistry';
import type {
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import type { SanitizePostClaudeAssistantDraftResult } from '@features/aria/sanitizePostClaudeAssistantDraftText';
import {
  INTERVIEW_TURN_ORCHESTRATOR_EXECUTE_DECISIONS_ENABLED,
  INTERVIEW_TURN_ORCHESTRATOR_COLLAPSE_M4_M5_INJECT_GATES,
  INTERVIEW_TURN_ORCHESTRATOR_PHASE3_ENABLED,
} from '@features/aria/interviewTurnOrchestratorConfig';

export type PostClaudeAssistantDraftValidation = {
  /** Draft is empty after sanitization — empty-transcript fallback may apply. */
  isEmptyDraft: boolean;
  /** Canonical probes the draft failed to deliver verbatim but params still require. */
  requiresForcedCanonicalProbeIds: InterviewCanonicalProbeId[];
  /** S1–S3 post-Claude forced probes can be skipped — pre-Claude orchestrator owns delivery. */
  skipScenarioForcedProbes: boolean;
  /** Run empty-transcript fallback when draft has no persistable content. */
  shouldRunEmptyTranscriptFallback: boolean;
  /** Skip M4 threshold post-Claude forced probe — orchestrator owns delivery. */
  skipMoment4ThresholdForced: boolean;
};

function draftContainsCanonicalProbeText(
  draftText: string,
  probeId: InterviewCanonicalProbeId,
): boolean {
  const canonical = INTERVIEW_CANONICAL_PROBES[probeId].verbatimText;
  const normalizedDraft = draftText.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedCanonical = canonical.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalizedCanonical) return false;
  return normalizedDraft.includes(normalizedCanonical.slice(0, 48));
}

/**
 * Unified post-Claude draft validation — consolidates forced-probe and empty-draft signals.
 */
export function validatePostClaudeAssistantDraft(args: {
  strippedText: string;
  params: PostClaudeAssistantTurnParams;
  draft: SanitizePostClaudeAssistantDraftResult;
}): PostClaudeAssistantDraftValidation {
  const { strippedText, params, draft } = args;
  const isEmptyDraft = strippedText.trim().length === 0;

  const requiresForcedCanonicalProbeIds: InterviewCanonicalProbeId[] = [];

  if (
    params.shouldForceScenarioAContemptProbe &&
    !draft.assistantIssuedScenarioAContemptProbe &&
    !draftContainsCanonicalProbeText(strippedText, 's1_contempt')
  ) {
    requiresForcedCanonicalProbeIds.push('s1_contempt');
  }
  if (
    params.shouldForceScenarioBJamesRepairProbe &&
    !draft.assistantIssuedScenarioBRepairAsJames &&
    !draftContainsCanonicalProbeText(strippedText, 's2_james_repair')
  ) {
    // S2 hypothetical repair probe retired — spontaneous repair still scores.
  }
  if (
    params.shouldForceScenarioCSophiePerspectiveProbe &&
    !draftContainsCanonicalProbeText(strippedText, 's3_sophie_perspective')
  ) {
    requiresForcedCanonicalProbeIds.push('s3_sophie_perspective');
  }

  const orchestratorOwnsPersonalMomentDelivery =
    INTERVIEW_TURN_ORCHESTRATOR_EXECUTE_DECISIONS_ENABLED &&
    INTERVIEW_TURN_ORCHESTRATOR_COLLAPSE_M4_M5_INJECT_GATES;

  const skipScenarioForcedProbes =
    INTERVIEW_TURN_ORCHESTRATOR_PHASE3_ENABLED &&
    params.suppressForcedConstructProbesForMetaFrustration !== true;

  const skipMoment4ThresholdForced =
    orchestratorOwnsPersonalMomentDelivery &&
    params.suppressForcedConstructProbesForMetaFrustration !== true;

  return {
    isEmptyDraft,
    requiresForcedCanonicalProbeIds,
    skipScenarioForcedProbes,
    shouldRunEmptyTranscriptFallback: isEmptyDraft,
    skipMoment4ThresholdForced,
  };
}
