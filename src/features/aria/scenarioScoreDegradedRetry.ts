import { SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS } from '@features/aria/interviewSkipPenalties';
import type { ScenarioScoreRecoveryStats } from '@features/aria/scenarioScoringParse';
import { coerceScoreToFiniteNumber } from '@features/aria/probeEvidenceUtils';

/** Thrown when a scenario score HTTP call succeeded but output is too thin to persist — triggers withRetry. */
export class ScenarioScoreDegradedError extends Error {
  readonly retryable = true;

  constructor(
    public readonly scenarioNumber: 1 | 2 | 3,
    public readonly reason: string,
    public readonly recoveryStats: ScenarioScoreRecoveryStats,
  ) {
    super(`scenario score degraded (${reason}) for scenario ${scenarioNumber}`);
    this.name = 'ScenarioScoreDegradedError';
  }
}

export function isScenarioScoreDegradedError(err: unknown): err is ScenarioScoreDegradedError {
  return err instanceof ScenarioScoreDegradedError;
}

/** Output token budget — scenario JSON includes per-marker keyEvidence + contempt_tier_breakdown. */
export function maxTokensForScenarioScore(scenarioNumber: 1 | 2 | 3): number {
  // S1 keyEvidence runs long (~9k chars observed); 2200 max_tokens truncated every retry and blocked preparing_results.
  if (scenarioNumber === 1) return 4096;
  if (scenarioNumber === 2) return 3600;
  return 4800;
}

/**
 * Decide whether to retry the Anthropic scenario scoring call.
 * S1 often ships thin keyEvidence by design in some cohorts — retry only on hard truncation there.
 */
export function shouldRetryScenarioScoreAfterPostProcess(params: {
  scenarioNumber: 1 | 2 | 3;
  parseError?: string | null;
  stopReason?: string | null;
  recoveryStats: ScenarioScoreRecoveryStats;
  pillarScores?: Record<string, number | null | undefined> | null;
  contemptTierBreakdown: unknown;
}): string | null {
  const { scenarioNumber, parseError, stopReason, recoveryStats, pillarScores, contemptTierBreakdown } =
    params;

  if (parseError?.trim()) return 'primary_json_parse_failed';
  if (stopReason === 'max_tokens') {
    const expectedMarkerCount = SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS[scenarioNumber].length;
    const salvagedMarkerCount = SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS[scenarioNumber].filter(
      (id) => coerceScoreToFiniteNumber(pillarScores?.[id]) !== undefined,
    ).length;
    // S1: accept truncated-but-salvaged numerics so completion does not spin on max_tokens retries.
    if (scenarioNumber === 1 && salvagedMarkerCount >= expectedMarkerCount) {
      return null;
    }
    return 'anthropic_max_tokens';
  }

  const contemptScored = coerceScoreToFiniteNumber(pillarScores?.contempt_expression) !== undefined;
  if (contemptScored && contemptTierBreakdown == null && scenarioNumber >= 2) {
    return 'missing_contempt_tier_breakdown';
  }

  if (scenarioNumber >= 2) {
    if (recoveryStats.usedRecoveryPath) return 'majority_recovered_key_evidence';
    if (recoveryStats.recoveredMarkerCount >= 2) return 'partial_recovered_key_evidence';
  }

  return null;
}

export function assertScenarioScoreQualityOrThrow(params: {
  scenarioNumber: 1 | 2 | 3;
  parseError?: string | null;
  stopReason?: string | null;
  recoveryStats: ScenarioScoreRecoveryStats;
  pillarScores?: Record<string, number | null | undefined> | null;
  contemptTierBreakdown: unknown;
}): void {
  const reason = shouldRetryScenarioScoreAfterPostProcess(params);
  if (!reason) return;
  throw new ScenarioScoreDegradedError(params.scenarioNumber, reason, params.recoveryStats);
}
