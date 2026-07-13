import { describe, expect, it } from '@jest/globals';

import { MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE } from '@features/aria/moment4ScoringParse';
import {
  assertScenarioScoreQualityOrThrow,
  maxTokensForScenarioScore,
  ScenarioScoreDegradedError,
  shouldRetryScenarioScoreAfterPostProcess,
} from '@features/aria/scenarioScoreDegradedRetry';

describe('scenarioScoreDegradedRetry', () => {
  it('raises token budgets for verbose scenario JSON (S3 highest, S1 above S2)', () => {
    expect(maxTokensForScenarioScore(3)).toBeGreaterThan(maxTokensForScenarioScore(2));
    expect(maxTokensForScenarioScore(1)).toBeGreaterThan(maxTokensForScenarioScore(2));
  });

  it('retries S3 when a majority of markers use recovered placeholder evidence', () => {
    const reason = shouldRetryScenarioScoreAfterPostProcess({
      scenarioNumber: 3,
      recoveryStats: {
        scoredMarkerCount: 6,
        recoveredMarkerCount: 4,
        usedRecoveryPath: true,
      },
      pillarScores: {
        repair: 5,
        regulation: 6,
        accountability: 5,
        mentalizing: 6,
        attunement: 5,
      },
      contemptTierBreakdown: null,
    });
    expect(reason).toBe('majority_recovered_key_evidence');
  });

  it('retries S3 when Anthropic stopped for max_tokens even if numerics salvaged', () => {
    const reason = shouldRetryScenarioScoreAfterPostProcess({
      scenarioNumber: 3,
      stopReason: 'max_tokens',
      recoveryStats: {
        scoredMarkerCount: 6,
        recoveredMarkerCount: 0,
        usedRecoveryPath: false,
      },
      pillarScores: { repair: 5, mentalizing: 6 },
      contemptTierBreakdown: { tier_2_prominence: 'low' },
    });
    expect(reason).toBe('anthropic_max_tokens');
  });

  it('accepts S1 max_tokens truncation when all marker numerics were salvaged', () => {
    const reason = shouldRetryScenarioScoreAfterPostProcess({
      scenarioNumber: 1,
      stopReason: 'max_tokens',
      recoveryStats: {
        scoredMarkerCount: 7,
        recoveredMarkerCount: 7,
        usedRecoveryPath: true,
      },
      pillarScores: {
        mentalizing: 4,
        accountability: 6,
        contempt_recognition: 5,
        contempt_expression: 8,
        repair: 6,
        attunement: 5,
        appreciation: 6,
      },
      contemptTierBreakdown: null,
    });
    expect(reason).toBeNull();
  });

  it('retries S2/S3 when contempt_expression scored but tier breakdown missing', () => {
    const reason = shouldRetryScenarioScoreAfterPostProcess({
      scenarioNumber: 3,
      recoveryStats: {
        scoredMarkerCount: 6,
        recoveredMarkerCount: 0,
        usedRecoveryPath: false,
      },
      pillarScores: { contempt_expression: 5, mentalizing: 6 },
      contemptTierBreakdown: null,
    });
    expect(reason).toBe('missing_contempt_tier_breakdown');
  });

  it('does not retry S1 solely for recovered placeholder majority', () => {
    const reason = shouldRetryScenarioScoreAfterPostProcess({
      scenarioNumber: 1,
      recoveryStats: {
        scoredMarkerCount: 6,
        recoveredMarkerCount: 6,
        usedRecoveryPath: true,
      },
      pillarScores: { repair: 5, mentalizing: 6 },
      contemptTierBreakdown: null,
    });
    expect(reason).toBeNull();
  });

  it('throws ScenarioScoreDegradedError for retry wiring', () => {
    expect(() =>
      assertScenarioScoreQualityOrThrow({
        scenarioNumber: 3,
        recoveryStats: {
          scoredMarkerCount: 4,
          recoveredMarkerCount: 2,
          usedRecoveryPath: false,
        },
        pillarScores: {
          repair: 5,
          regulation: 6,
          accountability: 5,
          contempt_expression: 4,
        },
        contemptTierBreakdown: null,
      }),
    ).toThrow(ScenarioScoreDegradedError);
  });

  it('accepts substantive S3 keyEvidence without retry', () => {
    expect(() =>
      assertScenarioScoreQualityOrThrow({
        scenarioNumber: 3,
        recoveryStats: {
          scoredMarkerCount: 6,
          recoveredMarkerCount: 0,
          usedRecoveryPath: false,
        },
        pillarScores: {
          repair: 6,
          regulation: 5,
          accountability: 6,
          contempt_expression: 4,
          mentalizing: 7,
          attunement: 6,
        },
        contemptTierBreakdown: { tier_2_prominence: 'moderate' },
      }),
    ).not.toThrow();
    expect(
      shouldRetryScenarioScoreAfterPostProcess({
        scenarioNumber: 3,
        recoveryStats: {
          scoredMarkerCount: 1,
          recoveredMarkerCount: 0,
          usedRecoveryPath: false,
        },
        pillarScores: { mentalizing: 6 },
        contemptTierBreakdown: null,
      }),
    ).toBeNull();
    expect(MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE).toContain('recovered');
  });
});
