import { describe, expect, it } from '@jest/globals';
import {
  assignAlgorithmEra,
  computeCronbachAlpha,
  computeOverviewAnalytics,
  detectScoreRecovery,
} from '../analytics';

describe('analytics', () => {
  it('computes Cronbach alpha when item totals vary', () => {
    const matrix = [
      [3, 4, 5, 6, 7, 8, 6, 5],
      [4, 5, 6, 7, 8, 7, 6, 5],
      [5, 6, 7, 8, 7, 6, 5, 4],
      [6, 7, 8, 7, 6, 5, 4, 3],
      [7, 8, 7, 6, 5, 4, 3, 4],
      [8, 7, 6, 5, 4, 3, 4, 5],
      [7, 6, 5, 4, 3, 4, 5, 6],
      [6, 5, 4, 3, 4, 5, 6, 7],
      [5, 4, 3, 4, 5, 6, 7, 8],
      [4, 3, 4, 5, 6, 7, 8, 7],
      [3, 4, 5, 6, 7, 8, 7, 6],
      [4, 5, 6, 7, 8, 7, 6, 5],
    ];
    const alpha = computeCronbachAlpha(matrix);
    expect(alpha).not.toBeNull();
    expect(Number.isFinite(alpha)).toBe(true);
  });

  it('returns null for insufficient Cronbach sample', () => {
    expect(computeCronbachAlpha([[1, 2], [2, 3]])).toBeNull();
  });

  it('detects score recovery in keyEvidence', () => {
    expect(
      detectScoreRecovery({
        keyEvidence: { mentalizing: 'Score recovered from model output.' },
      }),
    ).toBe(true);
    expect(detectScoreRecovery({ keyEvidence: { mentalizing: 'clear evidence' } })).toBe(false);
  });

  it('assigns algorithm era from created_at', () => {
    expect(assignAlgorithmEra('2026-03-15T00:00:00Z')).toBe('early');
    expect(assignAlgorithmEra('2026-04-15T00:00:00Z')).toBe('mid');
    expect(assignAlgorithmEra('2026-05-15T00:00:00Z')).toBe('current');
  });

  it('returns empty analytics for no attempts', () => {
    const result = computeOverviewAnalytics([], []);
    expect(result.sampleSize.total).toBe(0);
    expect(result.cronbachAlpha.pillars).toBeNull();
  });
});
