import { recoverPrematureInterviewCompleteBeforeM5 } from '@features/aria/recoverPrematureInterviewCompleteBeforeM5';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import {
  validatePostClaudeAssistantDraft,
  type PostClaudeAssistantDraftValidation,
} from '@features/aria/validatePostClaudeAssistantDraft';
import type { SanitizePostClaudeAssistantDraftResult } from '@features/aria/sanitizePostClaudeAssistantDraftText';

export type PostClaudeUnifiedDraftValidation = PostClaudeAssistantDraftValidation & {
  rawApiHadInterviewComplete: boolean;
  strippedPrematureComplete: boolean;
  appendedMoment5RecoveryBundle: boolean;
};

/**
 * Unified post-Claude validation: pre-M5 complete recovery on raw text + sanitized draft checks.
 */
export async function runPostClaudeUnifiedDraftValidation(args: {
  deps: PostClaudeAssistantTurnDeps;
  params: PostClaudeAssistantTurnParams;
  rawText: string;
  strippedText: string;
  draft: SanitizePostClaudeAssistantDraftResult;
}): Promise<{ text: string; validation: PostClaudeUnifiedDraftValidation }> {
  const rawRecovery = await recoverPrematureInterviewCompleteBeforeM5(
    args.deps,
    args.params,
    args.rawText,
  );
  const draftValidation = validatePostClaudeAssistantDraft({
    strippedText: args.strippedText,
    params: args.params,
    draft: args.draft,
  });

  return {
    text: rawRecovery.text,
    validation: {
      ...draftValidation,
      rawApiHadInterviewComplete: rawRecovery.rawApiHadInterviewComplete,
      strippedPrematureComplete: rawRecovery.strippedPrematureComplete,
      appendedMoment5RecoveryBundle: rawRecovery.appendedMoment5RecoveryBundle,
    },
  };
}
