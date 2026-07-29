import {
  coerceInvalidContinuationAssistantDraft,
  isApprovedElongatingProbeOnly,
  userTurnSuppressesElongatingProbe,
} from '@features/aria/elongatingProbe';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import { remoteLog } from '@utilities/remoteLog';

export type ApplyPostClaudeAssistantDraftElongatingResult = {
  strippedText: string;
  assistantTurnIsElongatingProbeOnly: boolean;
};

/** Elongating-probe duplicate suppression and fired-state side effects on sanitized draft text. */
export function applyPostClaudeAssistantDraftElongatingState(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  strippedTextIn: string,
  parallelStreamingPlaybackUsed: boolean,
): ApplyPostClaudeAssistantDraftElongatingResult {
  const coercedText = coerceInvalidContinuationAssistantDraft(strippedTextIn, params.trimmed);
  const wasCoercedToApprovedProbe =
    coercedText.trim() !== strippedTextIn.trim() && isApprovedElongatingProbeOnly(coercedText);
  let strippedText = coercedText;
  let assistantTurnIsElongatingProbeOnly = isApprovedElongatingProbeOnly(strippedText);

  if (
    params.elongatingSuppressedForUserTurn &&
    assistantTurnIsElongatingProbeOnly &&
    (!wasCoercedToApprovedProbe || userTurnSuppressesElongatingProbe(params.trimmed))
  ) {
    void remoteLog('[ELONGATING_PROBE_SUPPRESSED_OVERRIDE]', {
      wordCount: params.trimmed.split(/\s+/).filter(Boolean).length,
      preview: strippedText,
      shouldForceScenarioAContemptProbe: params.shouldForceScenarioAContemptProbe,
    });
    strippedText = '';
    assistantTurnIsElongatingProbeOnly = false;
    deps.elongatingProbeFiredRef.current = true;
    if (parallelStreamingPlaybackUsed) {
      deps.parallelStreamingTtsRef.current.cancelRequested = true;
    }
  } else if (deps.elongatingProbeFiredRef.current && assistantTurnIsElongatingProbeOnly) {
    void remoteLog('[ELONGATING_PROBE_DUPLICATE_SUPPRESSED]', {
      wordCount: params.trimmed.split(/\s+/).filter(Boolean).length,
      preview: strippedText,
    });
    strippedText = '';
    assistantTurnIsElongatingProbeOnly = false;
    if (parallelStreamingPlaybackUsed) {
      deps.parallelStreamingTtsRef.current.cancelRequested = true;
    }
  } else if (assistantTurnIsElongatingProbeOnly) {
    deps.elongatingProbeFiredRef.current = true;
  }

  return { strippedText, assistantTurnIsElongatingProbeOnly };
}
