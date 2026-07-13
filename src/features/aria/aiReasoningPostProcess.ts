/**
 * Re-export canonical AI reasoning post-process helpers (single source of truth for app + edge).
 * Client wires narrative evidence audit logging for persistence.
 * @see supabase/functions/_shared/aiReasoningPostProcess.ts
 */
export type {
  PrepareAIReasoningForPersistenceOptions,
} from '../../../supabase/functions/_shared/aiReasoningPostProcess';

export * from '../../../supabase/functions/_shared/aiReasoningPostProcess';

import {
  prepareAIReasoningForPersistence as prepareAIReasoningForPersistenceCore,
} from '../../../supabase/functions/_shared/aiReasoningPostProcess';
import { logNarrativeEvidenceAudit } from '@features/reports/narrativeEvidenceAudit';
import type { AIReasoningResult } from './aiReasoningUserPrompt';

export function prepareAIReasoningForPersistence(
  reasoning: AIReasoningResult,
  pillarScores: Record<string, number>,
  unassessedMarkers: string[] = [],
  weightedScore: number | null = null,
): Record<string, unknown> {
  return prepareAIReasoningForPersistenceCore(
    reasoning,
    pillarScores,
    unassessedMarkers,
    weightedScore,
    {
      onClaimMapAudit: (claimMap) =>
        logNarrativeEvidenceAudit({ pipeline: 'ai_reasoning', slices: [] }, claimMap),
    },
  );
}
