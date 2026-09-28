import { resolvePillarScoresForNarrativeFromAttempt } from '@features/aria/resolvePillarScoresForNarrative';
import type { InterviewAttemptPillarSourceRow } from '@features/onboarding/loadInterviewReportAttempt';
import { evaluateScoringStagesReadyForRollup } from '@features/psychometrics/ensureInterviewRollupArtifacts';
import { narrativeFailedWithMissingPillarScores } from '@utilities/kickClientInterviewNarrativeIfPending';

export type ClientNarrativeKickGateRow = InterviewAttemptPillarSourceRow & {
  passed?: boolean | null;
  reasoning_pending?: boolean | null;
  scoring_deferred?: boolean | null;
  ai_reasoning?: unknown;
};

export function attemptScoringStagesInFlight(row: ClientNarrativeKickGateRow | null | undefined): boolean {
  if (!row) return false;
  return !evaluateScoringStagesReadyForRollup(row).ready;
}

export function attemptHasResolvablePillarScoresForNarrative(
  row: ClientNarrativeKickGateRow | null | undefined,
): boolean {
  if (!row) return false;
  return resolvePillarScoresForNarrativeFromAttempt(row, row.passed === true) != null;
}

export function shouldDeferClientNarrativeForScoringInFlight(
  row: ClientNarrativeKickGateRow | null | undefined,
): boolean {
  if (!row) return true;
  if (attemptHasResolvablePillarScoresForNarrative(row)) return false;
  return attemptScoringStagesInFlight(row);
}

export function shouldKickClientNarrativeForAttempt(row: {
  reasoning_pending: boolean;
  hasPersistedPillarScores: boolean;
  ai_reasoning: Record<string, unknown> | null;
  sourceRow: ClientNarrativeKickGateRow | null | undefined;
}): boolean {
  const wantsNarrative =
    row.reasoning_pending ||
    (row.hasPersistedPillarScores && narrativeFailedWithMissingPillarScores(row.ai_reasoning));
  if (!wantsNarrative) return false;
  return !shouldDeferClientNarrativeForScoringInFlight(row.sourceRow);
}
